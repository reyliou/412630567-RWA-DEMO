const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function runExplain() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('連線成功，正在執行 EXPLAIN ANALYZE...');

        // 這是 kline 查詢的等效 SQL
        const query = `
            EXPLAIN ANALYZE 
            SELECT * FROM transactions 
            WHERE property_id = 1 
              AND status = 'SUCCESS' 
              AND created_at >= (NOW() - INTERVAL '31 days')
            ORDER BY created_at ASC 
            LIMIT 3000;
        `;
        
        const res = await client.query(query);
        console.log('\n================ 執行計畫結果 ================');
        res.rows.forEach(row => {
            console.log(row['QUERY PLAN']);
        });
        console.log('==============================================\n');

    } catch (e) {
        console.error('執行失敗:', e);
    } finally {
        await client.end();
    }
}

runExplain();
