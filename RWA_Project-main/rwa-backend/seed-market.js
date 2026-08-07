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
    let currentPrice = Number(property.current_price || 189.19);
    console.log(`\n========================================`);
    console.log(`處理建案: [${propertyId}] ${property.title}, 基準價: ${currentPrice}`);

    // --- 2. 注入 30 天歷史假交易 (給 K 線圖用) ---
    console.log("開始生成過去 30 天的歷史交易...");
    const historicalTxs = [];
    let simulatedPrice = currentPrice * 0.95; 
    
    const now = Date.now();

    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      
      const dailyTxCount = Math.floor(Math.random() * 10) + 5;
      for (let j = 0; j < dailyTxCount; j++) {
        const changePercent = (Math.random() * 1.1 - 0.5) / 100;
        simulatedPrice = simulatedPrice * (1 + changePercent);
        
        // 🔴 修正：加上 Math.min 確保不會生成未來的時間戳
        const timeOffset = new Date(Math.min(d.getTime() + Math.random() * 24 * 60 * 60 * 1000, now));
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
