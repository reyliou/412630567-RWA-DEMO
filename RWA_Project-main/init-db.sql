CREATE TABLE IF NOT EXISTS rwa_assets (
    property_id VARCHAR(50) PRIMARY KEY, -- 房產編號 (例如: A001)
    holder_address VARCHAR(42),          -- 持有者地址
    is_kyc_verified BOOLEAN DEFAULT FALSE, -- ERC-3643 的身分驗證
    total_supply NUMERIC DEFAULT 1,       -- 這專案規定只有 1 顆
    last_tx_hash VARCHAR(66),            -- 鏈上交易證明
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);