import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  connectionTimeoutMillis: 5000, // 5秒超時，避免無限卡死
  ssl: {
    rejectUnauthorized: false, // 允許雲端資料庫的自簽章憑證
  }
});

pool.on('error', (err, client) => {
  console.error('[DB POOL ERROR] Unexpected error on idle client', err);
});
pool.on('connect', () => {
  console.log('[DB CONNECTED] Successfully connected to Postgres pool');
});

app.use(cors());
app.use(express.json());

// 0. 健康檢查 (供 Render 部署監控使用)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'RWA Server is healthy' });
});

// 1. 系統性能指標 (真實測量)
app.get('/api/system/performance', async (req, res) => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - start;
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
      for(let type in cpu.times) totalTick += (cpu.times as any)[type];
      totalIdle += cpu.times.idle;
    });
    const cpuLoad = (1 - totalIdle / totalTick) * 100;
    res.json({ status: 'OK', dbLatency, cpuLoad: cpuLoad > 0 ? cpuLoad : 1.5, serverTime: new Date() });
  } catch (err) { res.status(500).json({ error: 'Check Failed' }); }
});

// 2. 獲取房產清單
app.get('/api/properties', async (req, res) => {
  const result = await pool.query('SELECT * FROM properties ORDER BY id DESC');
  res.json(result.rows);
});

// 3. 獲取用戶資產
app.get('/api/portfolio/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const userRes = await pool.query('SELECT total_asset_value, total_profit_loss FROM users WHERE id = $1', [userId]);
    const holdingsRes = await pool.query(`
      SELECT h.*, p.title, p.token_symbol, p.current_price, p.main_image
      FROM user_holdings h
      JOIN properties p ON h.property_id = p.id
      WHERE h.user_id = $1 AND h.balance > 0
    `, [userId]);
    res.json({ summary: userRes.rows[0], holdings: holdingsRes.rows });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

// 4. 獲取交易紀錄
app.get('/api/transactions/:userId', async (req, res) => {
  const result = await pool.query(`
    SELECT t.*, p.title as property_name FROM transactions t 
    JOIN properties p ON t.property_id = p.id 
    WHERE t.user_id = $1 ORDER BY t.created_at DESC
  `, [req.params.userId]);
  res.json(result.rows);
});

// 5. 獲取通知中心訊息
app.get('/api/notifications/:userId', async (req, res) => {
  const result = await pool.query('SELECT * FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.userId]);
  res.json(result.rows);
});

// 6. 核心交易處理 (10 秒延時撮合)
app.post('/api/transactions', async (req, res) => {
  const { user_id, property_id, tx_type, order_type, token_amount, price_per_token } = req.body;
  
  const executeTrade = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const totalTwdValue = parseFloat(token_amount) * parseFloat(price_per_token);

      // A. 寫入交易歷史
      await client.query(
        `INSERT INTO transactions (user_id, property_id, tx_type, order_type, token_amount, price_per_token, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS')`,
        [user_id, property_id, tx_type, order_type, token_amount, price_per_token]
      );

      // B. 更新餘額 (UPSERT)
      const change = tx_type === 'BUY' ? token_amount : -token_amount;
      await client.query(`
        INSERT INTO user_holdings (user_id, property_id, balance) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, property_id) DO UPDATE SET balance = user_holdings.balance + $3
      `, [user_id, property_id, change]);

      // C. 更新總資產
      await client.query(`
        UPDATE users SET total_asset_value = COALESCE(total_asset_value, 0) + ($1::numeric * $2::numeric) WHERE id = $3
      `, [change, price_per_token, user_id]);

      // D. 產生詳細通知
      const propRes = await client.query('SELECT title FROM properties WHERE id = $1', [property_id]);
      const propTitle = propRes.rows[0].title;
      const typeLabel = tx_type === 'BUY' ? '買入' : '賣出';
      const msg = `您對 ${propTitle} 的委託已成交。數量：${parseFloat(token_amount).toLocaleString()} 枚，總額：$${totalTwdValue.toLocaleString()} TWD。`;
      await client.query(`INSERT INTO user_notifications (user_id, title, message, is_read) VALUES ($1, $2, $3, false)`, 
        [user_id, `成交回報: ${typeLabel}成功`, msg]);

      // E. 寫入系統稽核日誌
      await client.query('INSERT INTO system_alerts (alert_type, severity, message) VALUES ($1, $2, $3)',
        ['ORDER_MATCH', 'INFO', `Matched ${order_type} ${tx_type} for UID ${user_id}`]);

      await client.query('COMMIT');
      console.log(`✅ [TRADE EXECUTED] User ${user_id} matched.`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error("Trade Error:", e);
    } finally { client.release(); }
  };

  if (order_type === 'LIMIT') {
    // 限價單：10 秒延時
    res.json({ success: true, message: '委託已送出，正在排隊撮合...' });
    setTimeout(executeTrade, 10000);
  } else {
    // 市價單：立即執行
    await executeTrade();
    res.json({ success: true });
  }
});

// 其他 API (通知已讀, 爬蟲狀態, 登入, K線)
app.patch('/api/notifications/:userId/read', async (req, res) => {
  await pool.query('UPDATE user_notifications SET is_read = true WHERE user_id = $1', [req.params.userId]);
  res.json({ success: true });
});
app.get('/api/system/crawler-status', async (req, res) => {
  const result = await pool.query('SELECT * FROM crawler_metrics WHERE id = 1');
  res.json(result.rows[0]);
});
app.post('/api/system/crawler-report', async (req, res) => {
  const { failures, integrity, status } = req.body;
  await pool.query('UPDATE crawler_metrics SET last_run_at = CURRENT_TIMESTAMP, consecutive_failures = $1, average_integrity = $2, status = $3 WHERE id = 1', [failures, integrity, status]);
  res.json({ success: true });
});
app.post('/api/login', async (req, res) => {
  console.log(`[LOGIN ATTEMPT] Received login request for user: ${req.body.username}`);
  const { username, password } = req.body;
  
  try {
    console.log(`[LOGIN ATTEMPT] Querying database...`);
    const result = await pool.query('SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = $1', [username]);
    console.log(`[LOGIN ATTEMPT] Query successful, found ${result.rows.length} rows`);
    
    if (result.rows.length > 0 && password === result.rows[0].password_hash) {
      console.log(`[LOGIN ATTEMPT] Password match for user: ${username}`);
      res.json({ success: true, user: { id: result.rows[0].id, username: result.rows[0].username, role: result.rows[0].role_name.toUpperCase().trim() } });
    } else { 
      console.log(`[LOGIN ATTEMPT] Invalid credentials for user: ${username}`);
      res.status(401).json({ success: false, message: '無效的帳號或密碼' }); 
    }
  } catch (err: any) {
    console.error(`[LOGIN ERROR] Database query failed:`, err.message);
    res.status(500).json({ success: false, message: '資料庫連線超時或失敗' });
  }
});
app.get('/api/properties/:id/valuation-logs', async (req, res) => {
  const result = await pool.query('SELECT * FROM valuation_logs WHERE property_id = $1 ORDER BY recorded_at ASC', [req.params.id]);
  res.json(result.rows);
});
app.get('/api/users', async (req, res) => {
  const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  res.json(result.rows);
});
app.get('/api/system-alerts', async (req, res) => {
  const result = await pool.query('SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT 30');
  res.json(result.rows);
});
app.get('/api/oversight', async (req, res) => {
  const result = await pool.query('SELECT p.*, b.current_cash_balance, b.pending_rent_amount FROM properties p LEFT JOIN bank_trust_accounts b ON p.id = b.property_id');
  res.json(result.rows);
});

app.listen(port, () => console.log(`🚀 RWA Master Server live on port ${port}`));
