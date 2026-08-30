const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

function getDatabaseUrl() {
  const envPath = path.join(__dirname, "..", "..", "rwa-backend", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        return trimmed.replace(/^DATABASE_URL=/, "").replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.DATABASE_URL;
}

const pgPath = path.join(__dirname, "..", "..", "rwa-backend", "node_modules", "pg");
const { Client } = require(pgPath);

async function main() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) throw new Error("找不到 DATABASE_URL，請確認 rwa-backend/.env 是否存在。");

  console.log("[Part 3 Setup] 正在連線資料庫讀取當前啟用的房產合約與目標用戶...");

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const propRes = await client.query(
    "SELECT id, title, token_address, token_symbol FROM properties WHERE token_address IS NOT NULL ORDER BY id ASC LIMIT 1;"
  );
  const userRes = await client.query(
    "SELECT id, username, wallet_address FROM users WHERE wallet_address IS NOT NULL AND username = 'reyliou' LIMIT 1;"
  );
  await client.end();

  if (propRes.rows.length === 0) throw new Error("資料庫中無任何已綁定 token_address 的房產！");
  if (userRes.rows.length === 0) throw new Error("找不到用戶 reyliou 的錢包地址！");

  const targetProperty = propRes.rows[0];
  const targetUser = userRes.rows[0];
  const tokenAddress = targetProperty.token_address;
  const recipientWallet = targetUser.wallet_address;

  console.log(`[Target Property] #${targetProperty.id} ${targetProperty.title} (${targetProperty.token_symbol || 'RWA'})`);
  console.log(`                  Token Address: ${tokenAddress}`);
  console.log(`[Target User]     #${targetUser.id} ${targetUser.username}`);
  console.log(`                  Wallet: ${recipientWallet}\n`);

  const [admin] = await ethers.getSigners();
  const token = await ethers.getContractAt("MySimpleRWA", tokenAddress);

  // 確保 Admin 有足夠餘額
  const transferAmount = ethers.parseUnits("50", 18);
  const adminBalance = await token.balanceOf(admin.address);
  if (adminBalance < transferAmount) {
    console.log("[Notice] 正在為 Admin 增發 10,000 代幣以供轉帳展示...");
    try { await (await token.mint(admin.address, ethers.parseUnits("10000", 18))).wait(); } catch(e) {}
  }

  // 確保代幣處於未暫停狀態
  try {
    const isPaused = await token.paused();
    if (isPaused) {
      console.log("[Notice] 代幣處於暫停狀態，正在 unpause 解鎖...");
      await (await token.unpause()).wait();
    }
  } catch(e) {}

  console.log(`[Action] 發起鏈上直連轉帳: 50.0 代幣 -> ${targetUser.username} (${recipientWallet})...`);
  const tx = await token.transfer(recipientWallet, transferAmount);
  const receipt = await tx.wait();

  console.log(`[Result] SUCCESS: txHash=${receipt.hash}`);
  console.log(`[Status] 鏈上已成功轉出 50 顆代幣，但資料庫 app_transactions 內【完全無此紀錄】！`);
  console.log(`[Next Step] 請至前端技術員後台點擊【啟動全節點對帳 (Reconcile)】展示自動偵測與修復。\n`);
}

main().catch((err) => {
  console.error("[Fatal Error]:", err.message);
  process.exitCode = 1;
});
