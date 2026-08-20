const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function getConstraints() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        // 查詢 user_holdings 表的所有約束
        const query = `
            SELECT conname AS constraint_name, contype AS constraint_type, pg_get_constraintdef(c.oid) AS constraint_def
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            JOIN pg_class t ON t.oid = c.conrelid
            WHERE t.relname = 'user_holdings' AND n.nspname = 'public';
        `;
        
        const res = await client.query(query);
        console.log('\n================ user_holdings 約束清單 ================');
        res.rows.forEach(row => {
            console.log(`名稱: ${row.constraint_name}`);
            console.log(`類型: ${row.constraint_type} (p:主鍵, f:外鍵, u:唯一, c:檢查)`);
            console.log(`定義: ${row.constraint_def}`);
            console.log('--------------------------------------------------------');
        });

    } catch (e) {
        console.error('執行失敗:', e);
    } finally {
        await client.end();
    }
}

getConstraints();
