/**
 * 故障注入測試 (Fault Injection Test) — 必要環境變數缺失
 * -------------------------------------------------------------
 * 放置位置：
 *   RWA_Project-main/rwa-backend/src/auth/fault-injection.spec.ts
 *
 * 執行方式：
 *   npx jest src/auth/fault-injection.spec.ts
 *
 * 注意：這裡用 jest.isolateModules() + require()，而不是 import()。
 * Jest 預設跑在 CommonJS 環境下，動態 import() 語法需要額外的
 * Node 旗標（--experimental-vm-modules）才能用，用 require() 搭配
 * isolateModules 可以達到一樣的效果（強制重新載入模組、重跑
 * module 頂層的環境變數檢查），而且不用改任何 Jest 設定。
 * -------------------------------------------------------------
 */

describe('故障注入測試 — 必要環境變數缺失時應 fail-fast', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('缺少 SUPABASE_SERVICE_KEY 時，AuthService 應該在建構時直接拋錯，而不是等到呼叫 API 才炸', () => {
    delete process.env.SUPABASE_SERVICE_KEY;
    process.env.IMAGE_ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 bytes，避免先撞到另一個檢查

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { AuthService } = require('./auth.service');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        new AuthService({} as any, {} as any, {} as any);
      });
    }).toThrow('SUPABASE_SERVICE_KEY is required but not set');
  });

  it('缺少 IMAGE_ENCRYPTION_KEY 時，整個 auth module 在載入當下就應該拋錯', () => {
    delete process.env.IMAGE_ENCRYPTION_KEY;
    process.env.SUPABASE_SERVICE_KEY = 'dummy-key-for-test';

    expect(() => {
      jest.isolateModules(() => {
        require('./auth.service');
      });
    }).toThrow('IMAGE_ENCRYPTION_KEY is required but not set');
  });
});
