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
import { User } from '../entities/user.entity';

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
      if (entity === User) return { id: 1, is_whitelisted: true, total_asset_value: 999999999999 };
      return null;
    }),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
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
    const runners: any[] = [];
    const dataSource = {
      createQueryRunner: jest.fn(() => {
        const qr = buildQueryRunner({ failOnCommit: true });
        runners.push(qr);
        return qr;
      }),
    } as any;

    const notifRepo = { save: jest.fn() } as any;
    const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, is_whitelisted: true, wallet_address: null, total_asset_value: 999999999999 }) } as any;
    const systemService = { getState: () => ({ isPaused: false }), isThrottled: () => false } as any;
    const blockchainService = {} as any;

    const service = new TransactionsService(notifRepo, userRepo, dataSource, systemService, blockchainService);

    await expect(
      service.createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999),
    ).rejects.toThrow('SIMULATED_DB_OUTAGE');

    const lastRunner = runners[runners.length - 1];
    expect(lastRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(lastRunner.release).toHaveBeenCalledTimes(1);
  });
});

describe('故障注入測試 — 鏈上呼叫逾時/失敗', () => {
  it('executeOnChainBuy 拋錯時，DB 仍應完成交易並標記為 CHAIN_FAILED，而不是整筆請求失敗', async () => {
    const runners: any[] = [];
    const dataSource = {
      createQueryRunner: jest.fn(() => {
        const qr = buildQueryRunner({ failOnCommit: false });
        runners.push(qr);
        return qr;
      }),
    } as any;

    const notifRepo = { save: jest.fn() } as any;
    const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, is_whitelisted: true, wallet_address: '0xUSER', total_asset_value: 999999999999 }) } as any;
    const systemService = { getState: () => ({ isPaused: false }), isThrottled: () => false } as any;
    const blockchainService = {
      executeOnChainBuy: jest.fn().mockRejectedValue(new Error('SIMULATED_CHAIN_TIMEOUT')),
    } as any;

    const service = new TransactionsService(notifRepo, userRepo, dataSource, systemService, blockchainService);

    const result: any = await service.createTransaction(1, 1, 'BUY', 'MARKET', 10, 999999);

    expect(result.success).toBe(true);

    const allSaves = runners.flatMap(r => r.manager.save.mock.calls);
    const savedTx = allSaves
      .map((call: any[]) => call[call.length - 1])
      .find((payload: any) => payload && 'status' in payload);

    expect(savedTx?.status).toBe('CHAIN_FAILED');
    const lastRunner = runners[runners.length - 1];
    expect(lastRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });
});
