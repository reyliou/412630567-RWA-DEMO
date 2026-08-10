/**
 * 整合測試 (Integration Test) + 權限測試 (Authorization Test)
 * -------------------------------------------------------------
 * 這份測試會真的透過 HTTP（supertest）打進 Nest 應用程式，
 * 完整跑過：JwtAuthGuard → Controller → Service 這條真實路徑。
 * 只有最底層的資料庫（Repository / DataSource）用 mock 取代，
 * 所以不需要真的連 Postgres / Supabase 就能跑，CI 也能直接執行。
 *
 * 放置位置（依專案結構）：
 *   RWA_Project-main/rwa-backend/test/integration-auth.e2e-spec.ts
 *
 * 執行方式：
 *   cd RWA_Project-main/rwa-backend
 *   npx jest --config ./test/jest-e2e.json test/integration-auth.e2e-spec.ts
 * -------------------------------------------------------------
 */

// JwtStrategy 在 module 載入當下就會讀 process.env.JWT_SECRET，
// 所以一定要在 import 任何 Nest 模組「之前」先設好。
process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-prod';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';

import { TransactionsController } from '../src/transactions/transactions.controller';
import { TransactionsService } from '../src/transactions/transactions.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { SystemService } from '../src/system/system.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { UserNotification } from '../src/entities/notification.entity';
import { User } from '../src/entities/user.entity';
import { AppTransaction } from '../src/entities/app-transaction.entity';
import { Property } from '../src/entities/property.entity';
import { UserHolding } from '../src/entities/user-holdings.entity';

describe('整合測試 + 權限測試 (e2e, mocked DB)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  // ---- 共用 mock：模擬 DB 內容 ----
  const MOCK_PROPERTY = {
    id: 1,
    title: '測試建案 A',
    total_supply_x: 100000,
    fundraising_goal: 18919000,
    current_price: 189.19,
    token_address: null,
  };

  const mockDataSource = {
    createQueryRunner: () => ({
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
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
      },
    }),
  };

  const mockUsersService = {
    findAll: jest.fn().mockResolvedValue([{ id: 1, username: 'demo' }]),
    updateWhitelist: jest.fn().mockResolvedValue({ success: true }),
    approveKyc: jest.fn().mockResolvedValue({ success: true }),
    decryptKycImages: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [TransactionsController, UsersController],
      providers: [
        TransactionsService,
        JwtStrategy,
        { provide: UsersService, useValue: mockUsersService },
        { provide: getRepositoryToken(UserNotification), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn().mockResolvedValue({ id: 1, is_whitelisted: true, wallet_address: null }) } },
        { provide: getRepositoryToken(AppTransaction), useValue: {} },
        { provide: getRepositoryToken(Property), useValue: {} },
        { provide: getRepositoryToken(UserHolding), useValue: {} },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SystemService, useValue: { getState: () => ({ isPaused: false }), isThrottled: () => false } },
        { provide: BlockchainService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function tokenFor(user: { id: number; username: string; role: string }) {
    return jwtService.sign(user);
  }

  // ================================================================
  // 權限測試：JWT 驗證本身
  // ================================================================
  describe('權限測試 — JWT 驗證', () => {
    it('未帶 Authorization header 打受保護的 API 應回 401', async () => {
      await request(app.getHttpServer()).get('/api/pending-orders').expect(401);
    });

    it('帶壞掉/篡改過的 token 應回 401', async () => {
      await request(app.getHttpServer())
        .get('/api/pending-orders')
        .set('Authorization', 'Bearer this.is.not.a.valid.jwt')
        .expect(401);
    });

    it('帶合法 token 應該通過驗證（不是 401）', async () => {
      const token = tokenFor({ id: 1, username: 'investor1', role: 'INVESTOR' });
      const res = await request(app.getHttpServer())
        .get('/api/pending-orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).not.toBe(401);
    });
  });

  // ================================================================
  // 權限測試：擁有者檢查（不能幫別人下單）
  // ================================================================
  describe('權限測試 — 資源擁有者檢查', () => {
    it('user_id 跟 token 裡的 id 不一致時應回 403（不能幫別人下單）', async () => {
      const token = tokenFor({ id: 1, username: 'investor1', role: 'INVESTOR' }); // 我是 1 號
      const res = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          user_id: 2, // 卻想用 2 號的身分下單
          property_id: 1,
          tx_type: 'BUY',
          order_type: 'MARKET',
          token_amount: 10,
          price_per_token: 999999,
        });

      expect(res.status).toBe(403);
    });

    it('user_id 跟 token 一致時應正常進入下單流程（不是 403）', async () => {
      const token = tokenFor({ id: 1, username: 'investor1', role: 'INVESTOR' });
      const res = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          user_id: 1,
          property_id: 1,
          tx_type: 'BUY',
          order_type: 'MARKET',
          token_amount: 10,
          price_per_token: 999999,
        });

      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });
  });

  // ================================================================
  // 權限測試：管理員專屬 API（角色檢查）
  // ================================================================
  describe('權限測試 — BUSINESS 角色專屬 API', () => {
    const adminOnlyEndpoints: Array<[string, string]> = [
      ['get', '/api/users'],
      ['patch', '/api/users/2/whitelist'],
      ['patch', '/api/users/2/kyc'],
      ['post', '/api/kyc/2/decrypt'],
    ];

    it.each(adminOnlyEndpoints)(
      '一般投資人 (INVESTOR) 呼叫 %s %s 應回 403',
      async (method, url) => {
        const token = tokenFor({ id: 1, username: 'investor1', role: 'INVESTOR' });
        const res = await (request(app.getHttpServer()) as any)[method](url)
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(403);
      },
    );

    it.each(adminOnlyEndpoints)(
      '管理員 (BUSINESS) 呼叫 %s %s 不應被擋在權限這關（不是 403）',
      async (method, url) => {
        const token = tokenFor({ id: 99, username: 'admin1', role: 'BUSINESS' });
        const res = await (request(app.getHttpServer()) as any)[method](url)
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(res.status).not.toBe(403);
      },
    );
  });

  // ================================================================
  // 整合測試：下單完整路徑（Controller → Guard → Service）
  // ================================================================
  describe('整合測試 — 下單完整路徑', () => {
    it('合法下單應該回傳 success:true，並帶有交易結果', async () => {
      const token = tokenFor({ id: 1, username: 'investor1', role: 'INVESTOR' });
      const res = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          user_id: 1,
          property_id: 1,
          tx_type: 'BUY',
          order_type: 'MARKET',
          token_amount: 10,
          price_per_token: 999999,
          idempotency_key: `itest-${Date.now()}`,
        })
        .expect(201);

      expect(res.body).toEqual(expect.objectContaining({ success: true }));
    });

    it('系統暫停時，就算通過所有權限檢查，下單也應該在 Service 層被擋下', async () => {
      // 這裡動態把 SystemService 換成「暫停中」的版本，驗證整條路徑真的有把
      // Service 層的業務規則串起來，而不是只測 Controller 本身
      const pausedModuleRef = await Test.createTestingModule({
        imports: [
          PassportModule,
          JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        ],
        controllers: [TransactionsController],
        providers: [
          TransactionsService,
          JwtStrategy,
          { provide: getRepositoryToken(UserNotification), useValue: { save: jest.fn() } },
          { provide: getRepositoryToken(User), useValue: { findOne: jest.fn().mockResolvedValue({ id: 1, is_whitelisted: true }) } },
          { provide: DataSource, useValue: mockDataSource },
          { provide: SystemService, useValue: { getState: () => ({ isPaused: true }), isThrottled: () => false } },
          { provide: BlockchainService, useValue: {} },
        ],
      }).compile();

      const pausedApp = pausedModuleRef.createNestApplication();
      await pausedApp.init();

      const token = jwtService.sign({ id: 1, username: 'investor1', role: 'INVESTOR' });
      const res = await request(pausedApp.getHttpServer())
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          user_id: 1,
          property_id: 1,
          tx_type: 'BUY',
          order_type: 'MARKET',
          token_amount: 10,
          price_per_token: 999999,
        });

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toContain('系統已暫停交易');

      await pausedApp.close();
    });
  });
});
