const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function runScaleExplain() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('連線成功，正在開啟資料庫交易 (Transaction)...');
        await client.query('BEGIN'); // 開啟交易

        const MOCK_COUNT = 50000; // 注入 5 萬筆
        console.log(`正在注入 ${MOCK_COUNT} 筆虛擬交易資料... (請稍候)`);
        
        // 插入假 User 和 Property 以滿足 Foreign Key 約束
        await client.query(`
            INSERT INTO users (id, username, email, password_hash, role_id) 
            VALUES (9999, 'mockuser', 'mock@test.com', 'hash', 1) 
            ON CONFLICT (id) DO NOTHING;
            
            INSERT INTO properties (id, title, location, complete_address, main_image, token_symbol, total_supply_x, current_price, status) 
            VALUES (9999, 'Mock Property', 'Taipei', 'Mock Addr', 'img.png', 'MCK', 100000, 100, '交易中') 
            ON CONFLICT (id) DO NOTHING;
        `);

        // 使用 generate_series 快速產生大量假資料 (分佈在過去 30 天內)
        await client.query(`
            INSERT INTO transactions (user_id, property_id, tx_type, order_type, token_amount, price_per_token, status, created_at, is_simulated)
            SELECT 
                9999, 
                9999, 
                'BUY', 
                'MARKET', 
                100, 
                200 + (random() * 10), 
                'SUCCESS', 
                NOW() - (random() * (INTERVAL '30 days')), 
                true
            FROM generate_series(1, ${MOCK_COUNT});
        `);
        console.log('注入完成！\n');

        console.log('================ 大規模資料 EXPLAIN ANALYZE 結果 ================');
        const query = `
            EXPLAIN ANALYZE 
            SELECT * FROM transactions 
            WHERE property_id = 9999 
              AND status = 'SUCCESS' 
              AND created_at >= (NOW() - INTERVAL '31 days')
            ORDER BY created_at ASC 
            LIMIT 3000;
        `;
        const res = await client.query(query);
        res.rows.forEach(row => {
            console.log(row['QUERY PLAN']);
        });
        console.log('==============================================================\n');

        console.log('正在還原資料庫狀態 (ROLLBACK)...');
        await client.query('ROLLBACK'); // 取消交易，假資料不會真的寫入資料庫
        console.log('狀態還原成功，資料庫維持乾淨！');

    } catch (e) {
        console.error('執行失敗:', e);
        await client.query('ROLLBACK'); // 發生錯誤也要還原
    } finally {
        await client.end();
    }
}

runScaleExplain();
