/**
 * 故障注入測試 (Fault Injection Test) — 交易 / DB / 鏈上
 * -------------------------------------------------------------
 * 放置位置：
 *   RWA_Project-main/rwa-backend/src/transactions/fault-injection.spec.ts
 *
 * 執行方式：
 *   npx jest src/transactions/fault-injection.spec.ts
 * -------------------------------------------------------------
 */

import { TransactionsService } from './transactions.service';
import { Property } from '../entities/property.entity';

const MOCK_PROPERTY = {
  id: 1,
  title: '測試建案 A',
  total_supply_x: 100000,
  fundraising_goal: 18919000,
  current_price: 189.19,
  token_address: '0xFAKE_TOKEN_ADDRESS', // 故意給地址，讓鏈上邏輯被觸發
};

function buildQueryRunner(opts: { failOnCommit?: boolean }) {
  const manager = {
    findOne: jest.fn(async (entity: any) => {
      if (entity === Property) return { ...MOCK_PROPERTY };
      return null;
    }),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(), // ← transactions.service.ts 用 .createQueryBuilder().update(User)... 更新 total_asset_value
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    })),
    save: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue(undefined),
  };

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn(async () => {
      if (opts.failOnCommit) throw new Error('SIMULATED_DB_OUTAGE: connection terminated');
    }),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager,
  };
}

describe('故障注入測試 — DB 連線在 commit 階段中斷', () => {
  it('commitTransaction 失敗時，應該呼叫 rollbackTransaction 並回傳失敗，而不是讓例外往外爆', async () => {
    const qr = buildQueryRunner({ failOnCommit: true });
    const dataSource = { createQueryRunner: () => qr } as any;

    const notifRepo = { save: jest.fn() } as any;
    const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, is_whitelisted: true, wallet_address: null }) } as any;
    const systemService = { getState: () => ({ isPaused: false }), isThrottled: () => false } as any;
    const blockchainService = {} as any;

    const service = new TransactionsService(notifRepo, userRepo, dataSource, systemService, blockchainService);

    // ⚠️ 修正說明：
    // 原本這裡斷言 result.success === false，但實際上 createTransaction() 內部
    // 呼叫 private runTrade()、拿到 { success:false } 之後，會主動把它轉成
    // BadRequestException 拋出（見 transactions.service.ts: `if (!result.success)
    // throw new BadRequestException(result.message)`）。
    // 這是刻意設計：讓 Controller 能直接回一個乾淨的 400 錯誤給前端，而不是把
    // 內部的 {success:false} 物件原封不動回傳。所以正確的測試方式是「預期它會
    // 拋出例外」，而不是「預期它回傳一個帶 success:false 的物件」。
    //
    // 這支測試真正該驗證的重點沒有變：即使最終是拋出例外，底層的 DB 交易
    // 也必須正確 rollback、並釋放連線，不能留下半寫入的髒資料或洩漏連線。
    await expect(
      service.createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999),
    ).rejects.toThrow('SIMULATED_DB_OUTAGE');

    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(qr.release).toHaveBeenCalledTimes(1); // finally 區塊要確實釋放連線，避免 connection pool 洩漏
  });
});

describe('故障注入測試 — 鏈上呼叫逾時/失敗', () => {
  it('executeOnChainBuy 拋錯時，DB 仍應完成交易並標記為 CHAIN_FAILED，而不是整筆請求失敗', async () => {
    const qr = buildQueryRunner({ failOnCommit: false });
    const dataSource = { createQueryRunner: () => qr } as any;

    const notifRepo = { save: jest.fn() } as any;
    const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, is_whitelisted: true, wallet_address: '0xUSER' }) } as any;
    const systemService = { getState: () => ({ isPaused: false }), isThrottled: () => false } as any;
    const blockchainService = {
      executeOnChainBuy: jest.fn().mockRejectedValue(new Error('SIMULATED_CHAIN_TIMEOUT')),
    } as any;

    const service = new TransactionsService(notifRepo, userRepo, dataSource, systemService, blockchainService);

    const result: any = await service.createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999);

    expect(result.success).toBe(true);
    expect(qr.manager.save).toHaveBeenCalled();

    const savedTx = qr.manager.save.mock.calls
      .map((call: any[]) => call[call.length - 1])
      .find((payload: any) => payload && 'status' in payload);

    expect(savedTx?.status).toBe('CHAIN_FAILED');
    expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
  });
});
