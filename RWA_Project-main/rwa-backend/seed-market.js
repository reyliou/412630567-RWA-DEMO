const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// 替換為您的 Supabase 專案 URL 與 Service Role Key
const supabase = createClient(
  'https://uowremtggfpoxxruiccw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd3JlbXRnZ2Zwb3h4cnVpY2N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIzNDUxOSwiZXhwIjoyMDk1ODEwNTE5fQ.RWruURweqRN0eu_24mBLm6TArDwu73wMTYIB52vV3Qw'
);

async function run() {
  console.log("🚀 開始注入造市機器人 (Market Maker) 資料...");

  // --- 1. 建立假帳號 ---
  let { data: bots } = await supabase.from('users').select('id').in('email', ['bot1@rwa.com', 'bot2@rwa.com', 'bot3@rwa.com']);
  if (!bots || bots.length === 0) {
    console.log("建立造市機器人帳號...");
    await supabase.from('users').insert([
      { email: 'bot1@rwa.com', name: 'Market Maker A', password: 'xyz', role: 'INVESTOR', kyc_status: 'VERIFIED', is_whitelisted: true },
      { email: 'bot2@rwa.com', name: 'Market Maker B', password: 'xyz', role: 'INVESTOR', kyc_status: 'VERIFIED', is_whitelisted: true },
      { email: 'bot3@rwa.com', name: 'Market Maker C', password: 'xyz', role: 'INVESTOR', kyc_status: 'VERIFIED', is_whitelisted: true }
    ]);
    const res = await supabase.from('users').select('id').in('email', ['bot1@rwa.com', 'bot2@rwa.com', 'bot3@rwa.com']);
    bots = res.data;
  }
  const botIds = bots.map(b => b.id);
  console.log(`✅ 已取得機器人帳號 IDs: ${botIds.join(', ')}`);

  // 取出第一個建案 (Property)
  const { data: properties } = await supabase.from('properties').select('*').limit(1);
  if (!properties || properties.length === 0) return console.log("找不到建案，腳本終止。");
  const propertyId = properties[0].id;
  let currentPrice = Number(properties[0].current_price || 189.19); // 修正欄位名稱

  console.log(`目標建案: [${propertyId}] ${properties[0].title}, 基準價: ${currentPrice}`);

  // --- 2. 注入 30 天歷史假交易 (給 K 線圖用) ---
  console.log("開始生成過去 30 天的歷史交易...");
  const historicalTxs = [];
  let simulatedPrice = currentPrice * 0.95; // 從 5% 折價開始慢慢爬升
  
  for (let i = 30; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    
    // 每天生成 5~15 筆交易
    const dailyTxCount = Math.floor(Math.random() * 10) + 5;
    for (let j = 0; j < dailyTxCount; j++) {
      // 模擬市場價格跳動 (-0.5% 到 +0.6%，微幅上漲趨勢)
      const changePercent = (Math.random() * 1.1 - 0.5) / 100;
      simulatedPrice = simulatedPrice * (1 + changePercent);
      
      const timeOffset = new Date(d.getTime() + Math.random() * 24 * 60 * 60 * 1000); // 隨機時間點
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

  // 為了避免重複灌水，先刪除舊的歷史假資料
  await supabase.from('transactions').delete().eq('property_id', propertyId).eq('is_simulated', true).eq('status', 'SUCCESS');
  
  // 批次插入歷史資料
  const { error: histErr } = await supabase.from('transactions').insert(historicalTxs);
  if (histErr) console.error("寫入歷史資料失敗:", histErr);
  else console.log(`✅ 成功寫入 ${historicalTxs.length} 筆歷史假交易！`);

  // --- 3. 注入五檔報價假掛單 (給掛單簿用) ---
  console.log("開始生成即時影子訂單 (Order Book)...");
  
  // 先清空之前的假掛單
  await supabase.from('transactions').delete().eq('property_id', propertyId).eq('is_simulated', true).eq('status', 'PENDING');

  const pendingOrders = [];
  const finalPrice = simulatedPrice; // 以歷史最後一筆價格為基準

  // 產生 20 筆委買 (BUY)，價格在基準價的 95% ~ 99.9% 之間 (越接近市價機率越高)
  for (let i = 0; i < 20; i++) {
    const discount = Math.pow(Math.random(), 2) * 0.05; // 平方分佈讓價格集中在市價附近
    const buyPrice = finalPrice * (1 - discount);
    pendingOrders.push({
      user_id: botIds[Math.floor(Math.random() * botIds.length)],
      property_id: propertyId,
      tx_type: 'BUY',
      order_type: 'LIMIT',
      token_amount: Math.floor(Math.random() * 500) + 50, // 買單數量較大 (呼應 75%)
      price_per_token: Number(buyPrice.toFixed(4)),
      status: 'PENDING',
      is_simulated: true,
      created_at: new Date().toISOString(),
      idempotency_key: uuidv4()
    });
  }

  // 產生 10 筆委賣 (SELL)，價格在基準價的 100.1% ~ 105% 之間
  for (let i = 0; i < 10; i++) {
    const premium = Math.pow(Math.random(), 2) * 0.05;
    const sellPrice = finalPrice * (1 + premium);
    pendingOrders.push({
      user_id: botIds[Math.floor(Math.random() * botIds.length)],
      property_id: propertyId,
      tx_type: 'SELL',
      order_type: 'LIMIT',
      token_amount: Math.floor(Math.random() * 200) + 20, // 賣單數量較小 (呼應 25%)
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

  // 更新 Property 最新價格為最終模擬價
  await supabase.from('properties').update({ current_price: Number(finalPrice.toFixed(4)) }).eq('id', propertyId);

  console.log("🎉 造市資料注入完畢！現在您可以回到網頁重新整理看看 K 線圖和五檔報價了！");
}

run();
