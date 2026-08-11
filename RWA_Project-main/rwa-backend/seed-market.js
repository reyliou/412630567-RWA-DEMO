require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// 🔴 安全性修正：不要將 Service Role Key 寫死在程式碼中，改由環境變數讀取
const supabaseUrl = process.env.DATABASE_URL_REST || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uowremtggfpoxxruiccw.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error("❌ 錯誤: 找不到 SUPABASE_SERVICE_KEY 環境變數。基於資安考量，請勿將金鑰寫死！");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("🚀 開始注入造市機器人 (Market Maker) 資料...");

  // --- 1. 建立假帳號 ---
  let { data: bots } = await supabase.from('users').select('id').in('email', ['bot1@rwa.com', 'bot2@rwa.com', 'bot3@rwa.com']);
  if (!bots || bots.length === 0) {
    console.log("建立造市機器人帳號...");
    const { error: insertErr } = await supabase.from('users').insert([
      { email: 'bot1@rwa.com', username: 'Market Maker A', password_hash: 'xyz', role_id: 1, kyc_status: 'VERIFIED', is_whitelisted: true },
      { email: 'bot2@rwa.com', username: 'Market Maker B', password_hash: 'xyz', role_id: 1, kyc_status: 'VERIFIED', is_whitelisted: true },
      { email: 'bot3@rwa.com', username: 'Market Maker C', password_hash: 'xyz', role_id: 1, kyc_status: 'VERIFIED', is_whitelisted: true }
    ]);
    if (insertErr) console.error("建立機器人失敗:", insertErr);
    
    const res = await supabase.from('users').select('id').in('email', ['bot1@rwa.com', 'bot2@rwa.com', 'bot3@rwa.com']);
    bots = res.data;
  }
  
  if (!bots || bots.length === 0) {
     console.error("無法取得機器人 ID，腳本終止");
     return;
  }
  const botIds = bots.map(b => b.id);
  console.log(`✅ 已取得機器人帳號 IDs: ${botIds.join(', ')}`);

  // 取出所有建案 (修正: 讓所有建案都有假資料)
  const { data: properties } = await supabase.from('properties').select('*');
  if (!properties || properties.length === 0) return console.log("找不到建案，腳本終止。");

  for (const property of properties) {
    const propertyId = property.id;

    // AMM 以 k = total_supply × fundraising_goal 定價，與 current_price 無關。
    // 流通量接近 0 時，實際成交價就是 fundraising_goal / total_supply。
    // 過去以 current_price 當基準會出問題：每跑一次腳本都從上次結果 ×0.95 起算再走約 +17%，
    // 淨效果約 ×1.11，重複執行後價格複利飆離 AMM 區間（實測已偏離 18 倍），
    // 造成畫面顯示 $541 但實際成交 $28.8。改用 AMM 隱含價當基準，重跑幾次都不會漂移。
    const totalSupply = Number(property.total_supply_x) || 100000;
    const ammPrice = Number(property.fundraising_goal)
      ? Number(property.fundraising_goal) / totalSupply
      : Number(property.current_price || 189.19);

    console.log(`\n========================================`);
    console.log(`處理建案: [${propertyId}] ${property.title}, AMM 基準價: ${ammPrice.toFixed(4)}`);

    // --- 2. 注入 30 天歷史假交易 (給 K 線圖用) ---
    console.log("開始生成過去 30 天的歷史交易...");
    const historicalTxs = [];
    let simulatedPrice = ammPrice * 0.95;

    const now = Date.now();

    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const dailyTxCount = Math.floor(Math.random() * 10) + 5;

      // 後端 getKLineData 會依 created_at 排序後才分日、取當天第一筆為 open、最後一筆為 close。
      // 原本 created_at 是當天內的純隨機值，與價格的遞推順序無關，等於把當天價格順序打亂，
      // open/close 變成隨機抽樣，K 棒的實體長度與紅綠方向都不具意義。
      // 把一天切成 dailyTxCount 個時段，第 j 筆落在第 j 段內，時間與價格就同步遞增。
      // 迴圈最後一圈是「今天」，而今天通常還沒過完。若照整日 24 小時切時段，
      // 超過當下的那些時段會被夾到現在時刻，導致當天多筆交易共用同一個 created_at；
      // 後端依 created_at 排序時遇到相同值順序不確定，open/close 又會退化成隨機抽樣，
      // 收盤價也就對不上校正後的 AMM 價。改成把時段壓縮進「已經過去」的區間。
      const dayStart = new Date(d).setHours(0, 0, 0, 0);
      const dayEnd = Math.min(dayStart + 24 * 60 * 60 * 1000, now);
      const span = Math.max(dayEnd - dayStart, dailyTxCount); // 至少讓每筆相差 1ms
      const slotMs = span / dailyTxCount;

      for (let j = 0; j < dailyTxCount; j++) {
        // 每天第一筆不套用波動，直接沿用前一日最後的成交價 ——
        // 連續市場中「今日開盤 = 昨日收盤」，這樣相鄰 K 棒之間完全不會出現跳空。
        // 第一天的第一筆則以基準價開盤。
        if (j > 0) {
          const changePercent = (Math.random() * 1.1 - 0.5) / 100;
          simulatedPrice = simulatedPrice * (1 + changePercent);
        }

        // 時段上限已是 dayEnd（不超過現在），因此這裡不會產生未來時間，也不需再夾一次
        const timeOffset = new Date(dayStart + slotMs * j + Math.random() * slotMs);
        const botId = botIds[Math.floor(Math.random() * botIds.length)];
        
        historicalTxs.push({
          user_id: botId,
          property_id: propertyId,
          tx_type: Math.random() > 0.5 ? 'BUY' : 'SELL',
          order_type: 'LIMIT_MATCHED',
          token_amount: Math.floor(Math.random() * 100) + 10,
          price_per_token: Number(simulatedPrice.toFixed(4)),
          status: 'SUCCESS',
          is_simulated: true,
          created_at: timeOffset.toISOString(),
          idempotency_key: uuidv4()
        });
      }
    }

    // 隨機漫步的每步區間是 [-0.5%, +0.6%)，平均 +0.05%，310 筆下來會累積約 +17%。
    // 走勢向上看起來比較像真實市場，但終點會高於 AMM 實際成交價，畫面與成交價就對不起來。
    // 等比縮放整條序列，讓最後一筆恰好等於 AMM 價 —— K 線形狀完全不變，但收在正確的價位。
    const scale = ammPrice / simulatedPrice;
    for (const tx of historicalTxs) {
      tx.price_per_token = Number((tx.price_per_token * scale).toFixed(4));
    }
    simulatedPrice = ammPrice;
    console.log(`  價格序列已校正，收盤價 = AMM 價 ${ammPrice.toFixed(4)}`);

    await supabase.from('transactions').delete().eq('property_id', propertyId).eq('is_simulated', true).eq('status', 'SUCCESS');

    const { error: histErr } = await supabase.from('transactions').insert(historicalTxs);
    if (histErr) console.error("寫入歷史資料失敗:", histErr);
    else console.log(`✅ 成功寫入 ${historicalTxs.length} 筆歷史假交易！`);

    // --- 3. 注入五檔報價假掛單 (給掛單簿用) ---
    console.log("開始生成即時影子訂單 (Order Book)...");
    await supabase.from('transactions').delete().eq('property_id', propertyId).eq('is_simulated', true).eq('status', 'PENDING');

    const pendingOrders = [];
    const finalPrice = simulatedPrice; 

    for (let i = 0; i < 20; i++) {
      const discount = Math.pow(Math.random(), 2) * 0.05; 
      const buyPrice = finalPrice * (1 - discount);
      pendingOrders.push({
        user_id: botIds[Math.floor(Math.random() * botIds.length)],
        property_id: propertyId,
        tx_type: 'BUY',
        order_type: 'LIMIT',
        token_amount: Math.floor(Math.random() * 500) + 50, 
        price_per_token: Number(buyPrice.toFixed(4)),
        status: 'PENDING',
        is_simulated: true,
        created_at: new Date().toISOString(),
        idempotency_key: uuidv4()
      });
    }

    for (let i = 0; i < 10; i++) {
      const premium = Math.pow(Math.random(), 2) * 0.05;
      const sellPrice = finalPrice * (1 + premium);
      pendingOrders.push({
        user_id: botIds[Math.floor(Math.random() * botIds.length)],
        property_id: propertyId,
        tx_type: 'SELL',
        order_type: 'LIMIT',
        token_amount: Math.floor(Math.random() * 200) + 20, 
        price_per_token: Number(sellPrice.toFixed(4)),
        status: 'PENDING',
        is_simulated: true,
        created_at: new Date().toISOString(),
        idempotency_key: uuidv4()
      });
    }

    const { error: pendingErr } = await supabase.from('transactions').insert(pendingOrders);
    if (pendingErr) console.error("寫入影子訂單失敗:", pendingErr);
    else console.log(`✅ 成功寫入 ${pendingOrders.length} 筆 PENDING 影子訂單！`);

    await supabase.from('properties').update({ current_price: Number(finalPrice.toFixed(4)) }).eq('id', propertyId);
  }

  console.log("\n🎉 所有建案造市資料注入完畢！");
}

run();
