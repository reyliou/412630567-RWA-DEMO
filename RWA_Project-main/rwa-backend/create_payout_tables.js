const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.uowremtggfpoxxruiccw:newsun87S6202963@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

const createTablesQuery = `
  CREATE TABLE IF NOT EXISTS rent_payout_batches (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    payout_period DATE NOT NULL,
    total_rent_collected NUMERIC NOT NULL,
    status VARCHAR DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rent_payout_details (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES rent_payout_batches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    holding_percentage NUMERIC NOT NULL,
    payout_amount NUMERIC NOT NULL,
    status VARCHAR DEFAULT 'CALCULATED',
    tx_hash VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

client.connect().then(() => {
  return client.query(createTablesQuery);
}).then(res => {
  console.log('Rent payout tables created successfully');
  return client.end();
}).catch(err => {
  console.error(err);
});
