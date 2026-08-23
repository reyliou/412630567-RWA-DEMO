/**
 * 故障注入測試 — 鏈上／鏈下狀態一致性
 * -------------------------------------------------------------
 * 放置位置：RWA_Project-main/rwa-backend/src/blockchain/fault-injection-integrity.spec.ts
 * 執行方式：npx jest src/blockchain/fault-injection-integrity.spec.ts
 *
 * 涵蓋五個指定情境：服務重啟、重複事件、Nonce 衝突、區塊重組、通知失敗。
 *
 * 【重要】其中兩項在本系統的架構下沒有字面上的對應機制：
 *   · 重複事件：系統不訂閱鏈上事件（全專案沒有 contract.on / WebSocket listener），
 *     唯一消費 Transfer 事件的地方是 reconcile() 的 queryFilter 全量重建。
 *     因此「同一事件被監聽兩次」不存在，等價風險是「對帳重複執行是否重複入帳」。
 *   · 區塊重組：程式沒有任何 reorg 專門處理，所有 .wait() 都是預設 1 個確認數。
 *     等價風險是「已寫入 DB 的交易若在鏈上被 reorg 掉，是否偵測得到」，
 *     而唯一的安全網是 reconcile()。
 * 這兩項的 describe 名稱均已標明測的是等價風險，不是原本字面的機制。
 * -------------------------------------------------------------
 */

import { ethers } from 'ethers';
import { Logger } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Property } from '../entities/property.entity';

const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const MOCK_PROPERTY = {
  id: 1,
  title: '測試建案 A',
  total_supply_x: 100000,
  fundraising_goal: 18919000,
  current_price: 189.19,
  token_address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
};

// 每個測試建立的 BlockchainService 都登記在這裡，測試結束後統一關閉底層的
// JsonRpcProvider。不關的話 ethers 會對著連不上的 RPC 持續每秒重試，
// 整份測試檔會從 3 秒膨脹到近 30 秒，並殘留成 open handle。
const createdChainServices: BlockchainService[] = [];

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const s of createdChainServices.splice(0)) {
    (s as any).provider?.destroy?.();
  }
});

afterAll(async () => {
  // ethers 在網路偵測失敗時會排程 1 秒後重試；若 destroy() 落在偵測進行中，
  // 那次已排程的重試仍會殘留。jest 只在整份檔案跑完後檢查，這裡等一次即可。
  await new Promise((resolve) => setTimeout(resolve, 1100));
  jest.restoreAllMocks();
});

// ──────────────────────────────────────────────────────────────
// TransactionsService 的測試骨架
// ──────────────────────────────────────────────────────────────

function buildQueryRunner(opts: { failOnCommit?: boolean; failOnNotification?: boolean } = {}) {
  const saved: any[] = [];
  const manager = {
    findOne: jest.fn(async (entity: any) => {
      if (entity === Property) return { ...MOCK_PROPERTY };
      return null;
    }),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    })),
    save: jest.fn(async (...args: any[]) => {
      const payload = args[args.length - 1];
      // 成交通知的辨識特徵：同時帶 title 與 is_read
      if (opts.failOnNotification && payload && 'is_read' in payload && 'title' in payload) {
        throw new Error('SIMULATED_NOTIFICATION_FAILURE: notification store unavailable');
      }
      saved.push(payload);
      return { id: 1 };
    }),
    update: jest.fn().mockResolvedValue(undefined),
  };

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn(async () => {
      if (opts.failOnCommit) throw new Error('SIMULATED_PROCESS_KILL: connection terminated');
    }),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager,
    saved,
  };
}

function buildTxService(qr: any, blockchainService: any, opts: { failOnNotification?: boolean } = {}) {
  const dataSource = { createQueryRunner: () => qr } as any;
  const notifRepo = {
    save: opts.failOnNotification
      ? jest.fn().mockRejectedValue(new Error('SIMULATED_NOTIFICATION_FAILURE: notification store unavailable'))
      : jest.fn().mockResolvedValue({ id: 1 }),
  } as any;
  const userRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1, is_whitelisted: true, wallet_address: USER_WALLET }),
  } as any;
  const systemService = { getState: () => ({ isPaused: false }), isThrottled: () => false } as any;
  const service = new TransactionsService(notifRepo, userRepo, dataSource, systemService, blockchainService);
  return Object.assign(service, { __notifRepo: notifRepo }) as TransactionsService & { __notifRepo: any };
}

// ──────────────────────────────────────────────────────────────
// BlockchainService 的測試骨架（對帳相關）
// ──────────────────────────────────────────────────────────────

type TransferEvent = { from: string; to: string; value: bigint; hash: string };

function buildChainService(
  opts: {
    transferEvents?: TransferEvent[];
    holdings?: Array<{ user_id: number; property_id: number; balance: number }>;
    recordedHashes?: string[];
    transferImpl?: any;
  } = {},
) {
  const events = (opts.transferEvents ?? []).map((e) => ({
    args: { from: e.from, to: e.to, value: e.value },
    transactionHash: e.hash,
  }));

  const propertyRepo = {
    find: jest.fn().mockResolvedValue([{ ...MOCK_PROPERTY }]),
    findOne: jest.fn().mockResolvedValue({ ...MOCK_PROPERTY }),
  } as any;
  const userRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 1, username: 'alice', wallet_address: USER_WALLET }),
  } as any;
  const configRepo = {
    find: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
  } as any;
  const holdingRepo = {
    find: jest.fn().mockResolvedValue(opts.holdings ?? []),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    update: jest.fn(),
  } as any;
  const appTxRepo = {
    find: jest.fn().mockResolvedValue((opts.recordedHashes ?? []).map((h) => ({ tx_hash: h }))),
  } as any;
  const systemService = { logAlert: jest.fn().mockResolvedValue(undefined) } as any;

  process.env.RPC_URL = 'http://127.0.0.1:1';
  process.env.ADMIN_KEY = ADMIN_KEY;
  delete process.env.NODE_ENV;

  const service = new BlockchainService(
    propertyRepo,
    userRepo,
    configRepo,
    holdingRepo,
    appTxRepo,
    systemService,
  );
  service.onModuleInit();
  createdChainServices.push(service);

  // 對帳需要節點可達；連線本身不是這裡要驗證的對象
  jest.spyOn(service, 'isNodeReachable').mockResolvedValue(true);

  const fakeToken = {
    filters: { Transfer: () => ({}) },
    queryFilter: jest.fn().mockResolvedValue(events),
    transfer: opts.transferImpl ?? jest.fn(),
    forcedTransfer: opts.transferImpl ?? jest.fn(),
  };
  (service as any).getContract = jest.fn(() => fakeToken);

  return { service, fakeToken, holdingRepo, systemService };
}

// ══════════════════════════════════════════════════════════════
// 情境一：服務重啟
// ══════════════════════════════════════════════════════════════

describe('故障注入 — 情境一：服務重啟後的 pending 交易狀態', () => {
  it('寫入途中程序被砍（commit 失敗）時，不得留下半完成狀態：必須 rollback 並釋放連線', async () => {
    const qr = buildQueryRunner({ failOnCommit: true });
    const blockchainService = {
      executeOnChainBuy: jest.fn().mockResolvedValue('0xCHAIN_HASH_1'),
    } as any;
    const service = buildTxService(qr, blockchainService);

    await expect(
      service.createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999),
    ).rejects.toThrow('SIMULATED_PROCESS_KILL');

    // 整筆回滾，資料庫不會留下 SUCCESS 或任何中間狀態
    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
    // 連線必須釋放，否則重啟前的殘留連線會拖垮連線池
    expect(qr.release).toHaveBeenCalledTimes(1);
  });

  it('🔴 已知風險：鏈上轉帳成功但 DB commit 失敗時，重啟後重新結算會再次執行鏈上轉帳', async () => {
    const blockchainService = {
      executeOnChainBuy: jest.fn().mockResolvedValue('0xCHAIN_HASH_1'),
    } as any;

    // 第一次：鏈上轉帳成功，但 commit 前程序中斷
    const qrCrashed = buildQueryRunner({ failOnCommit: true });
    await expect(
      buildTxService(qrCrashed, blockchainService).createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999),
    ).rejects.toThrow('SIMULATED_PROCESS_KILL');
    expect(blockchainService.executeOnChainBuy).toHaveBeenCalledTimes(1);

    // 第二次：服務重啟，同一筆委託被重新結算
    const qrRestarted = buildQueryRunner({});
    await buildTxService(qrRestarted, blockchainService).createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999);

    // 鏈上轉帳被執行了兩次，使用者卻只入帳一次 —— 多付出的代幣無法自動追回。
    // 成因：鏈上呼叫位於 DB commit 之前（transactions.service.ts 的
    // 「On-chain transfer (before DB commit)」），且重新結算前沒有檢查該筆是否
    // 已有 tx_hash，因此重啟後必然重跑鏈上動作。
    // 現況的安全網只有 reconcile()，屬事後偵測而非事前防止。
    expect(blockchainService.executeOnChainBuy).toHaveBeenCalledTimes(2);
  });
});

// ══════════════════════════════════════════════════════════════
// 情境二：重複事件
// ══════════════════════════════════════════════════════════════

describe('故障注入 — 情境二：重複事件（本系統無事件監聽器，測等價風險：對帳重複執行）', () => {
  it('對帳以 queryFilter 全量重建而非事件訂閱 —— 連續執行兩次不得重複累計不一致', async () => {
    const { service } = buildChainService({
      // 鏈上有一筆鑄給使用者的 500 枚，但資料庫完全沒有這筆持倉
      transferEvents: [
        { from: ethers.ZeroAddress, to: USER_WALLET, value: ethers.parseUnits('500', 18), hash: '0xAAA' },
      ],
      holdings: [],
      recordedHashes: [],
    });

    const first = await service.reconcile();
    const second = await service.reconcile();

    // 對帳是無狀態的全量比對，重跑不會讓同一筆不一致被算成兩筆
    expect(first.discrepancies.length).toBeGreaterThan(0);
    expect(second.discrepancies.length).toBe(first.discrepancies.length);
    expect(second.checkedProperties).toBe(first.checkedProperties);
  });

  it('同一筆 Transfer 事件已有對應交易紀錄時，不得再被判定為未追蹤轉帳（避免重複補建）', async () => {
    const { service } = buildChainService({
      transferEvents: [
        {
          from: USER_WALLET,
          to: MOCK_PROPERTY.token_address,
          value: ethers.parseUnits('100', 18),
          hash: '0xBBB',
        },
      ],
      holdings: [],
      // 資料庫已記錄這筆 txHash（比對時一律轉小寫）
      recordedHashes: ['0xbbb'],
    });

    const result = await service.reconcile();

    expect(result.discrepancies.filter((d) => d.type === 'UNTRACKED_TRANSFER')).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 情境三：Nonce 衝突
// ══════════════════════════════════════════════════════════════

describe('故障注入 — 情境三：Nonce 衝突', () => {
  function nonceError() {
    const e: any = new Error('nonce has already been used');
    e.code = 'NONCE_EXPIRED';
    return e;
  }

  it('鏈上轉帳遇到 nonce 衝突時，錯誤應如實往外拋，不得被吞掉造成成功假象', async () => {
    const { service } = buildChainService({
      transferImpl: jest.fn().mockRejectedValue(nonceError()),
    });

    await expect(
      service.executeOnChainBuy(MOCK_PROPERTY.token_address, USER_WALLET, 10),
    ).rejects.toThrow(/nonce/i);
  });

  it('nonce 脫節時應清除 NonceManager 快取，讓下一筆重新向節點取號', async () => {
    const { service } = buildChainService({
      transferImpl: jest.fn().mockRejectedValue(nonceError()),
    });
    const resetSpy = jest.spyOn((service as any).adminWallet, 'reset');

    await expect(
      service.executeOnChainBuy(MOCK_PROPERTY.token_address, USER_WALLET, 10),
    ).rejects.toThrow(/nonce/i);

    // 不清快取的話，本地 nonce 會一直沿用錯誤值，之後每一筆都失敗直到服務重啟
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('非 nonce 類的鏈上失敗不得觸發 reset —— 貿然重設在有交易在途時會造成重號', async () => {
    const complianceError: any = new Error('Transfer not possible');
    complianceError.code = 'CALL_EXCEPTION';

    const { service } = buildChainService({
      transferImpl: jest.fn().mockRejectedValue(complianceError),
    });
    const resetSpy = jest.spyOn((service as any).adminWallet, 'reset');

    await expect(
      service.executeOnChainBuy(MOCK_PROPERTY.token_address, USER_WALLET, 10),
    ).rejects.toThrow('Transfer not possible');

    // ERC-3643 合規擋下轉帳不會讓 nonce 脫節，不該清快取
    expect(resetSpy).not.toHaveBeenCalled();
  });

  it('nonce 衝突不得污染資料庫：該筆應標記為 CHAIN_FAILED，且不得寫入假的 tx_hash', async () => {
    const qr = buildQueryRunner({});
    const blockchainService = {
      executeOnChainBuy: jest.fn().mockRejectedValue(nonceError()),
    } as any;
    const service = buildTxService(qr, blockchainService);

    const result: any = await service.createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999);

    expect(result.success).toBe(true);
    const savedTx = qr.saved.find((p: any) => p && 'status' in p);
    expect(savedTx?.status).toBe('CHAIN_FAILED');
    // 鏈上失敗時絕不能留下 tx_hash，否則對帳會誤認為這筆已上鏈
    expect(savedTx?.tx_hash).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 情境四：區塊重組（reorg）
// ══════════════════════════════════════════════════════════════

describe('故障注入 — 情境四：區塊重組（本系統無 reorg 專門處理，測等價風險：對帳能否偵測）', () => {
  it('已入帳的轉帳在鏈上被 reorg 掉（Transfer 事件消失）時，對帳必須偵測為餘額不一致', async () => {
    const { service } = buildChainService({
      // reorg 後鏈上查無任何 Transfer 事件
      transferEvents: [],
      // 但資料庫仍記著使用者持有 500 枚
      holdings: [{ user_id: 1, property_id: 1, balance: 500 }],
    });

    const result = await service.reconcile();

    const mismatch = result.discrepancies.find((d) => d.type === 'BALANCE_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch?.onChainBalance).toBe('0');
    expect(mismatch?.dbBalance).toBe('500');
  });

  it('對帳偵測到不一致時應寫入 system_alerts，讓技術端稽核台看得到而非靜默', async () => {
    const { service, systemService } = buildChainService({
      transferEvents: [],
      holdings: [{ user_id: 1, property_id: 1, balance: 500 }],
    });

    await service.reconcile();

    expect(systemService.logAlert).toHaveBeenCalledWith(
      'BLOCKCHAIN',
      expect.stringMatching(/WARNING|ERROR/),
      expect.stringContaining('對帳'),
    );
  });
});

// ══════════════════════════════════════════════════════════════
// 情境五：通知失敗
// ══════════════════════════════════════════════════════════════

describe('故障注入 — 情境五：成交通知寄送失敗', () => {
  it('通知寫入失敗不得影響交易結果：交易須照常 commit，通知失敗只記錄告警', async () => {
    const qr = buildQueryRunner({});
    const blockchainService = {
      executeOnChainBuy: jest.fn().mockResolvedValue('0xCHAIN_HASH_1'),
    } as any;
    const service = buildTxService(qr, blockchainService, { failOnNotification: true });

    const result: any = await service.createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999);

    // 交易本身完全不受影響
    expect(result.success).toBe(true);
    expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
    // 鏈上轉帳已完成，且沒有被通知故障連帶回滾
    expect(blockchainService.executeOnChainBuy).toHaveBeenCalledTimes(1);
    // 通知確實被嘗試寫入（而且是失敗的那一次）
    expect(service.__notifRepo.save).toHaveBeenCalledTimes(1);
  });

  it('通知必須在 commit 之後才寫入，且不得再使用交易的 queryRunner', async () => {
    const qr = buildQueryRunner({});
    const blockchainService = {
      executeOnChainBuy: jest.fn().mockResolvedValue('0xCHAIN_HASH_1'),
    } as any;
    const service = buildTxService(qr, blockchainService);

    await service.createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999);

    // 通知改走獨立的 repository，交易範圍內不應再出現通知的寫入
    expect(service.__notifRepo.save).toHaveBeenCalledTimes(1);
    const notifiedInsideTx = qr.saved.some(
      (p: any) => p && 'is_read' in p && 'title' in p,
    );
    expect(notifiedInsideTx).toBe(false);

    // 這兩筆針對的是先前的缺口：通知原本以 qr.manager.save(UserNotification, ...)
    // 寫在 commit 之前，純通知層故障會連帶讓一筆「鏈上已轉帳成功」的交易整筆回滾，
    // 造成代幣在使用者鏈上錢包、平台帳上卻查無此筆的分歧。
    // 現已改為 commit 之後以獨立連線寫入，失敗僅記錄 ERROR。
  });
});
