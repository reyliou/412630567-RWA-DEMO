/**
 * BlockchainService 故障注入測試
 * -------------------------------------------------------------
 * 涵蓋類別：故障注入測試、負向測試
 *
 * 執行方式：
 *   cd RWA_Project-main/rwa-backend
 *   npx jest src/blockchain/fault-injection.spec.ts
 *
 * 與 transactions/fault-injection.spec.ts 的差別：
 *   那份把 BlockchainService 整個 mock 掉，驗證的是「上游拋錯時交易流程怎麼收拾」。
 *   這份不 mock ethers，直接讓 BlockchainService 連向一個真的連不上的 RPC 位址，
 *   驗證的是「BlockchainService 自己面對節點故障時的行為」——
 *   對應測試計畫第八章原本標註為「手動驗證」的「模擬區塊鏈 RPC 逾時」項目。
 * -------------------------------------------------------------
 */

import { Logger } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { SystemService } from '../system/system.service';

// 127.0.0.1:1 沒有任何服務在監聽，作業系統會立刻回 ECONNREFUSED，
// 比指向黑洞位址等到逾時快得多，測試不會因此拖慢。
const UNREACHABLE_RPC = 'http://127.0.0.1:1';

function makeRepoMock(findResult: any[] = []) {
  return {
    find: jest.fn().mockResolvedValue(findResult),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeSystemServiceMock() {
  return {
    logAlert: jest.fn().mockResolvedValue(undefined),
  } as unknown as SystemService;
}

// 每個測試建立的 service 都登記在這裡，測試結束後統一關閉底層的 JsonRpcProvider。
// 不關的話 ethers 會在背景持續重試連線，測試跑完仍在寫 log，jest 會噴一堆
// 「Cannot log after tests are done」，讓報告要附的執行紀錄變得難以閱讀。
const createdServices: BlockchainService[] = [];

function buildService() {
  const propertyRepo = makeRepoMock([]);
  const userRepo = makeRepoMock([]);
  const configRepo = makeRepoMock([]);
  const holdingRepo = makeRepoMock([]);
  const appTxRepo = makeRepoMock([]);
  const systemService = makeSystemServiceMock();

  const service = new BlockchainService(
    propertyRepo,
    userRepo,
    configRepo,
    holdingRepo,
    appTxRepo,
    systemService,
  );
  createdServices.push(service);

  return { service, configRepo, propertyRepo, systemService };
}

// 這些測試會刻意觸發連線失敗。NestJS Logger 的警告、以及 ethers 內部直接用
// console.log 印出的「failed to detect network, retry in 1s」都屬於預期行為，
// 一併靜音，讓報告要附的執行紀錄只剩測試結果本身。
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const s of createdServices.splice(0)) {
    (s as any).provider?.destroy?.();
  }
});

afterAll(async () => {
  // ethers 在網路偵測失敗時會排程 1 秒後重試。若 destroy() 剛好落在偵測進行中，
  // 那次已排程的重試仍會殘留成 open handle，jest 會回報 worker 未正常結束。
  // jest 只在整份測試檔跑完後檢查殘留，所以在這裡等一次即可 ——
  // 放在 afterEach 每個案例都等會讓整體時間多出數倍。
  await new Promise((resolve) => setTimeout(resolve, 1100));
  jest.restoreAllMocks();
});

describe('BlockchainService — 故障注入：區塊鏈節點無法連線', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.RPC_URL = UNREACHABLE_RPC;
    process.env.ADMIN_KEY =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('RPC 位址連不上時，初始化不應拋出例外讓整個服務起不來', () => {
    const { service } = buildService();
    // Provider 是延遲連線的，建構當下不會立刻失敗；重點是這裡不能炸掉。
    expect(() => service.onModuleInit()).not.toThrow();
  });

  it('isNodeReachable() 面對連不上的節點應回傳 false，而不是拋例外', async () => {
    const { service } = buildService();
    service.onModuleInit();

    await expect(service.isNodeReachable()).resolves.toBe(false);
  });

  it('getStatus() 應照常回應並標示節點不可達，不因節點故障而讓 API 掛掉', async () => {
    const { service } = buildService();
    service.onModuleInit();

    const status = await service.getStatus();

    expect(status.nodeReachable).toBe(false);
    expect(status.infraDeployed).toBe(false);
    // 即使節點連不上，仍應回報 admin 位址供技術端比對設定
    expect(status.adminWallet).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('setupBlockchain() 應以明確訊息拒絕，而不是靜默失敗或卡住', async () => {
    const { service } = buildService();
    service.onModuleInit();

    await expect(service.setupBlockchain()).rejects.toThrow(/Hardhat 節點未啟動/);
  });

  it('節點故障應寫入 system_alerts 供技術端稽核台顯示', async () => {
    const { service, systemService } = buildService();
    service.onModuleInit();

    await service.setupBlockchain().catch(() => undefined);

    expect(systemService.logAlert).toHaveBeenCalledWith(
      'BLOCKCHAIN',
      'ERROR',
      expect.stringContaining('部署中止'),
    );
  });

  it('reconcile() 在節點不可達時應拒絕執行，避免以殘缺的鏈上資料誤判持倉', async () => {
    const { service } = buildService();
    service.onModuleInit();

    await expect(service.reconcile()).rejects.toThrow(/節點未啟動/);
  });
});

describe('BlockchainService — 負向：正式環境缺少 ADMIN_KEY', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('正式環境未設定 ADMIN_KEY 時，應拒絕以公開的 Hardhat 測試私鑰啟動鏈上功能', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_KEY;
    process.env.RPC_URL = UNREACHABLE_RPC;

    const { service, systemService } = buildService();
    service.onModuleInit();

    // Provider 未初始化，所有鏈上操作維持停用
    await expect(service.isNodeReachable()).resolves.toBe(false);
    expect(systemService.logAlert).toHaveBeenCalledWith(
      'BLOCKCHAIN',
      'ERROR',
      expect.stringContaining('ADMIN_KEY'),
    );
  });

  it('開發環境未設定 ADMIN_KEY 時仍可使用 Hardhat 預設帳戶，不影響本機開發', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_KEY;
    process.env.RPC_URL = UNREACHABLE_RPC;

    const { service, systemService } = buildService();
    expect(() => service.onModuleInit()).not.toThrow();

    // 開發環境不應出現拒絕啟動的錯誤紀錄
    expect(systemService.logAlert).not.toHaveBeenCalledWith(
      'BLOCKCHAIN',
      'ERROR',
      expect.stringContaining('ADMIN_KEY'),
    );
  });
});
