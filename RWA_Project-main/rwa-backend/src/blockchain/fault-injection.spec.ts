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

    await expect(service.reconcile()).rejects.toThrow(/區塊鏈節點目前離線休眠中/);
  });
});

/**
 * autoRecoverNodeState() 是每 30 秒執行一次的排程，偵測到「節點失憶」就會自動
 * 呼叫 setupBlockchain() 重新部署整套 T-REX 並重新鑄造。誤判的代價是鏈上餘額全部歸零，
 * 是整個服務裡後果最重的一條自動化路徑，因此三種判斷結果都必須有測試守住。
 */
describe('BlockchainService — 故障注入：節點失憶的自動重建判斷', () => {
  const ORIGINAL_ENV = { ...process.env };
  const IR_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  beforeEach(() => {
    process.env.RPC_URL = UNREACHABLE_RPC;
    process.env.ADMIN_KEY =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  // 讓服務進入「節點連得上、且資料庫記得曾經部署過」的狀態，
  // 使流程能推進到 isConfigStale() 這個真正要驗證的判斷點。
  function buildRecoverableService(getCodeImpl: () => Promise<string>) {
    const built = buildService();
    const { service, configRepo } = built;
    service.onModuleInit();

    jest.spyOn(service, 'isNodeReachable').mockResolvedValue(true);
    configRepo.findOne.mockResolvedValue({ key: 'ir_address', value: IR_ADDRESS });
    (service as any).provider.getCode = jest.fn(getCodeImpl);

    const setupSpy = jest
      .spyOn(service, 'setupBlockchain')
      .mockResolvedValue(undefined as any);

    return { ...built, setupSpy };
  }

  it('節點不可達時排程應直接跳過，不得觸發重建', async () => {
    const { service, configRepo } = buildService();
    service.onModuleInit();

    const setupSpy = jest
      .spyOn(service, 'setupBlockchain')
      .mockResolvedValue(undefined as any);

    await service.autoRecoverNodeState();

    expect(setupSpy).not.toHaveBeenCalled();
    // 應在可達性檢查就返回，連讀取 ir_address 都不該發生
    expect(configRepo.findOne).not.toHaveBeenCalled();
  });

  it('🔒 getCode 因網路異常拋錯時不得重建 —— RPC 瞬斷不等於合約消失', async () => {
    const { service, setupSpy } = buildRecoverableService(() =>
      Promise.reject(new Error('network timeout')),
    );

    await service.autoRecoverNodeState();

    // 若此處誤判為「失憶」而重建，線上鏈上餘額會因一次網路抖動全部歸零
    expect(setupSpy).not.toHaveBeenCalled();
  });

  it('getCode 確實回傳 0x（合約真的不存在）時才應觸發重建', async () => {
    const { service, setupSpy } = buildRecoverableService(() => Promise.resolve('0x'));

    await service.autoRecoverNodeState();

    expect(setupSpy).toHaveBeenCalledTimes(1);
  });

  it('前一次重建尚未結束時，下一次排程應被 isRecovering 擋下，且結束後要能再次執行', async () => {
    // 重建整套 T-REX 耗時遠超過 30 秒的排程間隔，因此下一次排程必然在前一次
    // 還沒結束時就進來。若沒有重入防護，同一次失憶會被重複部署多次。
    let releaseSetup!: () => void;
    const setupGate = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });

    const { service, setupSpy } = buildRecoverableService(() => Promise.resolve('0x'));
    setupSpy.mockImplementation(() => setupGate as any);

    // 第一次排程：推進到 setupBlockchain 後卡在 setupGate，重建進行中
    const inFlight = service.autoRecoverNodeState();
    await new Promise((resolve) => setImmediate(resolve));
    expect(setupSpy).toHaveBeenCalledTimes(1);

    // 第二次排程在重建進行中進來，應直接返回
    await service.autoRecoverNodeState();
    expect(setupSpy).toHaveBeenCalledTimes(1);

    // 重建結束後旗標必須歸位，否則往後再也不會自動修復
    releaseSetup();
    await inFlight;

    await service.autoRecoverNodeState();
    expect(setupSpy).toHaveBeenCalledTimes(2);
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
