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

  it('應帶入 60 天的時間下限，避免數月前的零星交易在圖上變成孤立 K 棒', async () => {
    const { service, appTxRepo } = buildService([]);

    await service.getKLineData(1);

    const where = appTxRepo.find.mock.calls[0][0].where;
    expect(where.created_at).toBeDefined();

    // TypeORM 的 MoreThanOrEqual 會把比較值放在 _value
    const since: Date = (where.created_at as any)._value;
    const daysAgo = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeGreaterThan(59.9);
    expect(daysAgo).toBeLessThan(60.1);
  });
});
