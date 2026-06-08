import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'rwa-bank-super-secret-key-2026';

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err, client) => {
  console.error('[DB POOL ERROR]', err);
});
pool.on('connect', () => {
  console.log('[DB CONNECTED] PostgreSQL pool connected');
});

app.use(cors());
app.use(express.json());

// ==========================================
// 🛡️ Security Middlewares
// ==========================================

// Rate Limiter for Login (防禦 Credential Stuffing / 暴力破解)
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分鐘
  max: 10, // 每 5 分鐘最多 10 次嘗試
  message: { success: false, message: '登入嘗試次數過多，請於 5 分鐘後再試。' }
});

// JWT Authentication Middleware (防禦越權存取 / 驗證身分)
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: '拒絕存取：未提供授權憑證' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: '憑證無效或已過期' });
    req.user = user;
    next();
  });
};

// ==========================================
// 🚀 Public Routes (無需 JWT)
// ==========================================

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'RWA Server is healthy' });
});

let lastCpuIdle = 0; let lastCpuTick = 0;
// 簡易記憶體聊天紀錄 (供展示用)
let globalChatMessages: any[] = [{ id: 1, sender: 'system', content: '💬 跨部門協作頻道已建立', timestamp: new Date() }];

// 簡易記憶體系統狀態 (供展示用，同步暫停與請求狀態)
let globalSystemState = {
  isPaused: false,
  throttleStartTime: null as Date | null,
  activeRequest: "NONE",
  requestReason: ""
};

app.get('/api/system/performance', async (req, res) => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - start;
    const cpus = os.cpus();
    let currentIdle = 0, currentTick = 0;
    cpus.forEach(cpu => {
      for(let type in cpu.times) currentTick += (cpu.times as any)[type];
      currentIdle += cpu.times.idle;
    });
    let cpuLoad = 1.5;
    if (lastCpuTick > 0) {
      const idleDiff = currentIdle - lastCpuIdle;
      const totalDiff = currentTick - lastCpuTick;
      if (totalDiff > 0) cpuLoad = 100 - ~~(100 * idleDiff / totalDiff);
    }
    lastCpuIdle = currentIdle; lastCpuTick = currentTick;
    res.json({ status: 'OK', dbLatency, cpuLoad: Math.max(1.2, cpuLoad + (Math.random()*2-1)), serverTime: new Date() });
  } catch (err) { res.status(500).json({ error: 'Check Failed' }); }
});

app.get('/api/system/crawler-status', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM crawler_metrics WHERE id = 1');
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/system/crawler-report', async (req, res) => {
  const { failures, integrity, status } = req.body;
  try {
    await pool.query('UPDATE crawler_metrics SET last_run_at = CURRENT_TIMESTAMP, consecutive_failures = $1, average_integrity = $2, status = $3 WHERE id = 1', [failures, integrity, status]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

// 🛡️ Secure Login Route with Bcrypt & Rate Limiting
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: '無效的帳號或密碼' });
    }

    const user = result.rows[0];
    
    // 🛡️ 使用 bcrypt 進行安全的密碼雜湊比對
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '無效的帳號或密碼' });
    }

    // 🛡️ 發行 JWT Token
    const tokenPayload = { id: user.id, username: user.username, role: user.role_name };
    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    res.json({ 
      success: true, 
      token: accessToken, // 回傳 Token 給前端
      user: { id: user.id, username: user.username, role: user.role_name.toUpperCase().trim() } 
    });
  } catch (err: any) {
    console.error(`[LOGIN ERROR]`, err.message);
    res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
});

// ==========================================
// 🔒 Protected Routes (需要 JWT Token)
// ==========================================

// 🛡️ 系統狀態同步 API (僅限技術員與業務員)
app.get('/api/system/state', authenticateToken, (req: any, res: any) => {
  if (req.user.role !== 'TECHNICAL' && req.user.role !== 'BUSINESS') return res.status(403).json({ error: '權限不足' });
  res.json(globalSystemState);
});

app.post('/api/system/state', authenticateToken, (req: any, res: any) => {
  if (req.user.role !== 'TECHNICAL' && req.user.role !== 'BUSINESS') return res.status(403).json({ error: '權限不足' });
  
  const { isPaused, activeRequest, requestReason } = req.body;
  
  if (isPaused !== undefined) globalSystemState.isPaused = isPaused;
  if (activeRequest !== undefined) globalSystemState.activeRequest = activeRequest;
  if (requestReason !== undefined) globalSystemState.requestReason = requestReason;
  
  if (isPaused === false && globalSystemState.throttleStartTime === null) {
     globalSystemState.throttleStartTime = new Date();
  } else if (isPaused === true) {
     globalSystemState.throttleStartTime = null;
  }

  res.json({ success: true, state: globalSystemState });
});

// 🛡️ 內部戰情室對話 API (僅限技術員與業務員)
app.get('/api/chat', authenticateToken, (req: any, res: any) => {
  if (req.user.role !== 'TECHNICAL' && req.user.role !== 'BUSINESS') return res.status(403).json({ error: '權限不足' });
  res.json(globalChatMessages);
});

app.post('/api/chat', authenticateToken, (req: any, res: any) => {
  if (req.user.role !== 'TECHNICAL' && req.user.role !== 'BUSINESS') return res.status(403).json({ error: '權限不足' });
  const { sender, content } = req.body;
  const newMessage = { id: Date.now(), sender, content, timestamp: new Date() };
  globalChatMessages.push(newMessage);
  if (globalChatMessages.length > 100) globalChatMessages.shift();
  res.json({ success: true, message: newMessage });
});

app.get('/api/properties', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.get('/api/properties/:id/valuation-logs', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM valuation_logs WHERE property_id = $1 ORDER BY recorded_at ASC', [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.get('/api/portfolio/:userId', authenticateToken, async (req: any, res) => {
  // 🛡️ IDOR 防護：確保只能查自己的資產 (除非是管理員)
  if (req.user.id !== parseInt(req.params.userId) && req.user.role !== 'TECHNICAL' && req.user.role !== 'BUSINESS') {
    return res.status(403).json({ error: '權限不足' });
  }
  
  try {
    const userRes = await pool.query('SELECT total_asset_value, total_profit_loss FROM users WHERE id = $1', [req.params.userId]);
    const holdingsRes = await pool.query(`
      SELECT h.*, p.title, p.token_symbol, p.current_price, p.main_image
      FROM user_holdings h JOIN properties p ON h.property_id = p.id
      WHERE h.user_id = $1 AND h.balance > 0
    `, [req.params.userId]);
    res.json({ summary: userRes.rows[0], holdings: holdingsRes.rows });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.get('/api/transactions/:userId', authenticateToken, async (req: any, res) => {
  if (req.user.id !== parseInt(req.params.userId) && req.user.role !== 'TECHNICAL' && req.user.role !== 'BUSINESS') return res.status(403).json({ error: '權限不足' });
  try {
    const result = await pool.query('SELECT t.*, p.title as property_name FROM transactions t JOIN properties p ON t.property_id = p.id WHERE t.user_id = $1 ORDER BY t.created_at DESC', [req.params.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.get('/api/notifications/:userId', authenticateToken, async (req: any, res) => {
  if (req.user.id !== parseInt(req.params.userId)) return res.status(403).json({ error: '權限不足' });
  try {
    const result = await pool.query('SELECT * FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.patch('/api/notifications/:userId/read', authenticateToken, async (req: any, res) => {
  if (req.user.id !== parseInt(req.params.userId)) return res.status(403).json({ error: '權限不足' });
  try {
    await pool.query('UPDATE user_notifications SET is_read = true WHERE user_id = $1', [req.params.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/transactions', authenticateToken, async (req: any, res) => {
  const { user_id, property_id, tx_type, order_type, token_amount, price_per_token } = req.body;
  if (req.user.id !== parseInt(user_id)) return res.status(403).json({ error: '權限不足' });
  
  const amount = parseFloat(token_amount);
  const price = parseFloat(price_per_token);
  if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) return res.status(400).json({ success: false, message: '無效的交易數量或價格' });
  
  const executeTrade = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const propRes = await client.query('SELECT title, current_price FROM properties WHERE id = $1', [property_id]);
      if (propRes.rows.length === 0) throw new Error("建案不存在");
      
      const realProperty = propRes.rows[0];
      const finalExecutionPrice = order_type === 'MARKET' ? parseFloat(realProperty.current_price) : price;
      const totalTwdValue = amount * finalExecutionPrice;

      await client.query(
        `INSERT INTO transactions (user_id, property_id, tx_type, order_type, token_amount, price_per_token, status) VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS')`,
        [user_id, property_id, tx_type, order_type, amount, finalExecutionPrice]
      );
      const change = tx_type === 'BUY' ? amount : -amount;
      await client.query(`INSERT INTO user_holdings (user_id, property_id, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id, property_id) DO UPDATE SET balance = user_holdings.balance + $3`, [user_id, property_id, change]);
      await client.query(`UPDATE users SET total_asset_value = COALESCE(total_asset_value, 0) + ($1::numeric * $2::numeric) WHERE id = $3`, [change, finalExecutionPrice, user_id]);
      
      const typeLabel = tx_type === 'BUY' ? '買入' : '賣出';
      const msg = `您對 ${realProperty.title} 的委託已成交。數量：${amount.toLocaleString()} 枚，總額：$${totalTwdValue.toLocaleString()} TWD。`;
      await client.query(`INSERT INTO user_notifications (user_id, title, message, is_read) VALUES ($1, $2, $3, false)`, [user_id, `成交回報: ${typeLabel}成功`, msg]);
      await client.query('INSERT INTO system_alerts (alert_type, severity, message) VALUES ($1, $2, $3)', ['ORDER_MATCH', 'INFO', `Matched ${order_type} ${tx_type} for UID ${user_id} at price ${finalExecutionPrice}`]);

      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error("Trade Error:", e.message);
    } finally { client.release(); }
  };

  if (order_type === 'LIMIT') {
    res.json({ success: true, message: '委託已送出，正在排隊撮合...' });
    setTimeout(executeTrade, 10000);
  } else {
    await executeTrade();
    res.json({ success: true });
  }
});

// Admin Only Routes
app.get('/api/users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'BUSINESS') return res.status(403).json({ error: '需要管理員權限' });
  try {
    const result = await pool.query('SELECT id, username, email, is_whitelisted, kyc_status, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.patch('/api/users/:id/whitelist', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'BUSINESS') return res.status(403).json({ error: '需要管理員權限' });
  try {
    await pool.query('UPDATE users SET is_whitelisted = $1 WHERE id = $2', [req.body.is_whitelisted, req.params.id]);
    await pool.query('INSERT INTO system_alerts (alert_type, severity, message) VALUES ($1, $2, $3)', ['SECURITY_AUDIT', 'WARNING', `Admin UID ${req.user.id} modified whitelist status for UID ${req.params.id}. Reason: ${req.body.reason}`]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.get('/api/system-alerts', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'TECHNICAL') return res.status(403).json({ error: '需要技術員權限' });
  try {
    const result = await pool.query('SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT 30');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.get('/api/oversight', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'BUSINESS') return res.status(403).json({ error: '需要管理員權限' });
  try {
    const result = await pool.query('SELECT p.*, b.current_cash_balance, b.pending_rent_amount FROM properties p LEFT JOIN bank_trust_accounts b ON p.id = b.property_id');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.listen(port, () => console.log(`🚀 RWA Secure Server live on port ${port}`));
