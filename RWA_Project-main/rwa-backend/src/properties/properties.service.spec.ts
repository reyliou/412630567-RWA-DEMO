/**
 * PropertiesService 測試 — K 線資料 (getKLineData)
 * -------------------------------------------------------------
 * 涵蓋類別：單元測試、合約測試（回傳格式）、效能面（查詢上限）
 *
 * 放置位置（依專案結構）：
 *   RWA_Project-main/rwa-backend/src/properties/properties.service.spec.ts
 *
 * 執行方式：
 *   cd RWA_Project-main/rwa-backend
 *   npx jest src/properties/properties.service.spec.ts
 * -------------------------------------------------------------
 */

import { PropertiesService } from './properties.service';

function buildService(transactions: any[]) {
  const appTxRepo = {
    find: jest.fn().mockResolvedValue(transactions),
  } as any;

  // 其餘 repo / service 在 getKLineData 裡完全用不到，給空 mock 即可
  const noop = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), update: jest.fn() } as any;
  const blockchainService = {} as any;

  const service = new PropertiesService(
    noop, // propertyRepo
    noop, // valuationRepo
    noop, // batchRepo
    noop, // detailRepo
    noop, // holdingRepo
    noop, // userRepo
    noop, // trustAccountRepo
    noop, // trustTxRepo
    appTxRepo, // appTxRepo ← getKLineData 唯一會用到的
    blockchainService,
  );

  return { service, appTxRepo };
}

// ==================================================================
// 單元測試：時區轉換 (+8 修正)
// ==================================================================
describe('PropertiesService.getKLineData — 單元測試：台北時區歸類', () => {
  it('UTC 16:30（台北時間隔天 00:30）應該被歸類到「隔天」的 K 棒，而不是當天', async () => {
    // 2026-08-06T16:30:00Z → 台北時間 2026-08-07 00:30
    const { service } = buildService([
      {
        id: 1,
        created_at: '2026-08-06T16:30:00.000Z',
        price_per_token: '190',
        token_amount: '10',
        status: 'SUCCESS',
      },
    ]);

    const result = await service.getKLineData(1);

    expect(result).toHaveLength(1);
    expect(result[0].time).toBe('2026-08-07'); // 應該是台北日期，不是 UTC 日期 2026-08-06
  });

  it('UTC 23:59（台北時間 07:59，同一個台北日）不應該被推到隔天', async () => {
    const { service } = buildService([
      {
        id: 1,
        created_at: '2026-08-06T23:59:00.000Z',
        price_per_token: '190',
        token_amount: '10',
        status: 'SUCCESS',
      },
    ]);

    const result = await service.getKLineData(1);

    expect(result[0].time).toBe('2026-08-07'); // UTC 23:59 + 8hr = 台北 08-07 07:59
  });

  it('同一個台北日的多筆交易應合併成一根 K 棒，並正確計算 open/high/low/close/volume', async () => {
    const { service } = buildService([
      { id: 1, created_at: '2026-08-07T01:00:00.000Z', price_per_token: '100', token_amount: '5', status: 'SUCCESS' },
      { id: 2, created_at: '2026-08-07T03:00:00.000Z', price_per_token: '120', token_amount: '3', status: 'SUCCESS' },
      { id: 3, created_at: '2026-08-07T05:00:00.000Z', price_per_token: '90', token_amount: '2', status: 'SUCCESS' },
    ]);

    const result = await service.getKLineData(1);

    expect(result).toHaveLength(1);
    const bar = result[0];
    expect(bar.open).toBe(100); // 時間序上最早那筆
    expect(bar.high).toBe(120);
    expect(bar.low).toBe(90);
    expect(bar.close).toBe(90); // 時間序上最晚那筆
    expect(bar.volume).toBe(10); // 5 + 3 + 2
  });

  it('沒有任何交易紀錄時應回傳空陣列，而不是報錯', async () => {
    const { service } = buildService([]);
    const result = await service.getKLineData(1);
    expect(result).toEqual([]);
  });
});

// ==================================================================
// 合約測試：回傳格式
// ==================================================================
describe('PropertiesService.getKLineData — 合約測試：回傳格式', () => {
  it('每個元素都必須包含 time/open/high/low/close/volume 六個欄位，型別正確', async () => {
    const { service } = buildService([
      { id: 1, created_at: '2026-08-07T01:00:00.000Z', price_per_token: '100', token_amount: '5', status: 'SUCCESS' },
    ]);

    const result = await service.getKLineData(1);

    expect(result[0]).toEqual(
      expect.objectContaining({
        time: expect.any(String),
        open: expect.any(Number),
        high: expect.any(Number),
        low: expect.any(Number),
        close: expect.any(Number),
        volume: expect.any(Number),
      }),
    );
  });
});

// ==================================================================
// 效能面：查詢上限 (take: 3000) 與時間視窗
// ==================================================================
describe('PropertiesService.getKLineData — 查詢範圍', () => {
  it('appTxRepo.find 呼叫時應帶入 take: 3000，避免無上限查詢全部歷史', async () => {
    const { service, appTxRepo } = buildService([]);

    await service.getKLineData(1);

    expect(appTxRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ property_id: 1, status: 'SUCCESS' }),
        take: 3000,
      }),
    );
  });

  it('時間下限應與造市資料的 31 天歷史對齊，使視窗內每一天都有資料、真實交易不會落單', async () => {
    const { service, appTxRepo } = buildService([]);

    await service.getKLineData(1);

    const where = appTxRepo.find.mock.calls[0][0].where;
    expect(where.created_at).toBeDefined();

    // TypeORM 的 MoreThanOrEqual 會把比較值放在 _value
    const since: Date = (where.created_at as any)._value;
    const daysAgo = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeGreaterThan(30.9);
    expect(daysAgo).toBeLessThan(31.1);
  });
});

// ==================================================================
// 單元測試：租金分潤引擎 (executePayout) 精度與信託帳本實報實銷
// ==================================================================
describe('PropertiesService.executePayout — 金融精度與信託記帳', () => {
  it('未滿額認購時，信託現金帳戶應實報實銷（只扣除發放總額，未售出份額實質保留於專戶）', async () => {
    const mockBatchRepo = { save: jest.fn().mockResolvedValue({ id: 101 }), update: jest.fn() } as any;
    const mockDetailRepo = { save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 1, ...d })) } as any;
    const mockPropertyRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, title: '台北大安大樓', total_supply_x: 100000 }),
    } as any;
    // 投資人共持有 40,000 枚 (40%)
    const mockHoldingRepo = {
      find: jest.fn().mockResolvedValue([
        { user_id: 1, balance: 25000 },
        { user_id: 2, balance: 15000 },
      ]),
    } as any;
    const mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, wallet_address: null }),
      increment: jest.fn().mockResolvedValue(undefined),
    } as any;
    const mockTrustAccount = {
      id: 5,
      property_id: 1,
      pending_rent_amount: 100000,
      current_cash_balance: 500000,
    };
    const mockTrustAccountRepo = {
      findOne: jest.fn().mockResolvedValue(mockTrustAccount),
      save: jest.fn().mockImplementation((acc) => Promise.resolve(acc)),
    } as any;
    const mockTrustTxRepo = { save: jest.fn() } as any;
    const mockNotifRepo = { save: jest.fn() } as any;

    const service = new PropertiesService(
      mockPropertyRepo,
      {} as any,
      mockBatchRepo,
      mockDetailRepo,
      mockHoldingRepo,
      mockUserRepo,
      mockTrustAccountRepo,
      mockTrustTxRepo,
      {} as any, // appTxRepo
      mockNotifRepo, // notifRepo
      {} as any, // blockchainService
    );

    const result = await service.executePayout(1, 100000);

    // 總收取 10 萬，但只發給 40% 的持有人 ($40,000)
    expect(result.total_collected).toBe(100000);
    expect(result.total_distributed).toBe(40000);
    expect(result.retained_in_trust).toBe(60000);

    // 信託專戶扣款實報實銷：500,000 - 40,000 = 460,000 (而不是 400,000)
    expect(mockTrustAccount.current_cash_balance).toBe(460000);
    expect(mockTrustAccount.pending_rent_amount).toBe(0);

    // 信託流水帳只記錄實際扣除金額 40,000
    expect(mockTrustTxRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        trust_account_id: 5,
        tx_type: 'PAYOUT_DEDUCTION',
        amount: 40000,
      }),
    );
  });

  it('除不盡的持股比例應精確至小數點後兩位（分），避免浮點數發散', async () => {
    const mockBatchRepo = { save: jest.fn().mockResolvedValue({ id: 102 }), update: jest.fn() } as any;
    const mockDetailRepo = { save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 1, ...d })) } as any;
    const mockPropertyRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, title: '大安大樓', total_supply_x: 100000 }),
    } as any;
    // 3 人各持有 33,333 枚 (33.333%)，總收取租金 1,000 元
    const mockHoldingRepo = {
      find: jest.fn().mockResolvedValue([
        { user_id: 1, balance: 33333 },
        { user_id: 2, balance: 33333 },
        { user_id: 3, balance: 33333 },
      ]),
    } as any;
    const mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, wallet_address: null }),
      increment: jest.fn().mockResolvedValue(undefined),
    } as any;
    const mockTrustAccount = {
      id: 5,
      property_id: 1,
      pending_rent_amount: 1000,
      current_cash_balance: 10000,
    };
    const mockTrustAccountRepo = {
      findOne: jest.fn().mockResolvedValue(mockTrustAccount),
      save: jest.fn().mockImplementation((acc) => Promise.resolve(acc)),
    } as any;
    const mockTrustTxRepo = { save: jest.fn() } as any;
    const mockNotifRepo = { save: jest.fn() } as any;

    const service = new PropertiesService(
      mockPropertyRepo,
      {} as any,
      mockBatchRepo,
      mockDetailRepo,
      mockHoldingRepo,
      mockUserRepo,
      mockTrustAccountRepo,
      mockTrustTxRepo,
      {} as any, // appTxRepo
      mockNotifRepo, // notifRepo
      {} as any, // blockchainService
    );

    const result = await service.executePayout(1, 1000);

    // 每人算出來是 (33333 / 100000) * 1000 = 333.33 元
    expect(mockDetailRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 1,
        payout_amount: 333.33,
      }),
    );

    // 3 人合計分出 999.99 元，剩下的 0.01 元尾差實質留存信託專戶
    expect(result.total_distributed).toBe(999.99);
    expect(result.retained_in_trust).toBe(0.01);
    expect(mockTrustAccount.current_cash_balance).toBe(9000.01);
  });
});

