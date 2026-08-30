const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

// 自適應讀取 rwa-backend/.env 的 DATABASE_URL，免安裝額外 dotenv
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

// 從 rwa-backend 解析 pg 模組
const pgPath = path.join(__dirname, "..", "..", "rwa-backend", "node_modules", "pg");
const { Client } = require(pgPath);

const KYC_TOPIC = 1;
const COUNTRY_CODE = 886;

async function issueKycClaim(identityContract, adminIdentityAddr, adminSigner) {
  const identityAddr = await identityContract.getAddress();
  const claimData = "0x";
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [identityAddr, BigInt(KYC_TOPIC), claimData]
    )
  );
  const signature = await adminSigner.signMessage(ethers.getBytes(dataHash));
  await (
    await identityContract.addClaim(KYC_TOPIC, 1, adminIdentityAddr, signature, claimData, "")
  ).wait();
}

async function main() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) throw new Error("找不到 DATABASE_URL，請確認 rwa-backend/.env 是否存在。");

  console.log("[Part 3 Setup] 正在連線資料庫讀取房產合約與目標用戶...");

  // 1. 連線資料庫取得房產與用戶
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const propRes = await client.query(
    "SELECT id, title, token_address, token_symbol FROM properties WHERE token_address IS NOT NULL LIMIT 1;"
  );
  const userRes = await client.query(
    "SELECT id, username, wallet_address FROM users WHERE wallet_address IS NOT NULL LIMIT 1;"
  );
  await client.end();

  if (propRes.rows.length === 0) throw new Error("資料庫中無任何已綁定 token_address 的房產！");
  if (userRes.rows.length === 0) throw new Error("資料庫中無任何已配置錢包地址的用戶！");

  const targetProperty = propRes.rows[0];
  const targetUser = userRes.rows[0];
  const tokenAddress = targetProperty.token_address;
  const recipientWallet = targetUser.wallet_address;

  console.log(`[Target Property] #${targetProperty.id} ${targetProperty.title} (${targetProperty.token_symbol})`);
  console.log(`                  Token Address: ${tokenAddress}`);
  console.log(`[Target User]     #${targetUser.id} ${targetUser.username}`);
  console.log(`                  Wallet: ${recipientWallet}\n`);

  const [admin] = await ethers.getSigners();

  // 2. 取得合約實例
  let token;
  try {
    token = await ethers.getContractAt("MySimpleRWA", tokenAddress);
    await token.name();
  } catch {
    // 若本機 Hardhat 重啟過導致合約未部署，自動在此地址就地部署實例
    console.log("[Notice] 偵測到本地節點重置，正在為該地址快速部署模擬合約...");
    const irs = await (await ethers.getContractFactory("MyIdentityRegistryStorage")).deploy();
    await (await irs.init()).wait();
    const tir = await (await ethers.getContractFactory("MyTrustedIssuersRegistry")).deploy();
    await (await tir.init()).wait();
    const ctr = await (await ethers.getContractFactory("MyClaimTopicsRegistry")).deploy();
    await (await ctr.init()).wait();
    await (await ctr.addClaimTopic(KYC_TOPIC)).wait();
    const ir = await (await ethers.getContractFactory("MyIdentityRegistry")).deploy();
    await (await irs.addAgent(await ir.getAddress())).wait();
    await (await ir.init(await tir.getAddress(), await ctr.getAddress(), await irs.getAddress())).wait();
    await (await ir.addAgent(admin.address)).wait();

    const adminIdentity = await (await ethers.getContractFactory("MyIdentity")).deploy(admin.address, false);
    const adminIdentityAddr = await adminIdentity.getAddress();
    await (await ir.registerIdentity(admin.address, adminIdentityAddr, COUNTRY_CODE)).wait();
    await (await tir.addTrustedIssuer(adminIdentityAddr, [KYC_TOPIC])).wait();
    await issueKycClaim(adminIdentity, adminIdentityAddr, admin);

    const compliance = await (await ethers.getContractFactory("MyModularCompliance")).deploy();
    await (await compliance.init()).wait();

    token = await (await ethers.getContractFactory("MySimpleRWA")).deploy();
    await (await token.init(await ir.getAddress(), await compliance.getAddress(), targetProperty.title, targetProperty.token_symbol || "RWA", 18, ethers.ZeroAddress)).wait();
    await (await token.addAgent(admin.address)).wait();
    await (await token.unpause()).wait();

    const userIdentity = await (await ethers.getContractFactory("MyIdentity")).deploy(admin.address, false);
    await (await ir.registerIdentity(recipientWallet, await userIdentity.getAddress(), COUNTRY_CODE)).wait();
    await issueKycClaim(userIdentity, adminIdentityAddr, admin);

    // 鑄造 1000 顆給 admin
    await (await token.mint(admin.address, ethers.parseUnits("1000", 18))).wait();

    // 更新 DB 中的 token_address 為當前實例地址
    const liveAddr = await token.getAddress();
    const updateClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await updateClient.connect();
    await updateClient.query("UPDATE properties SET token_address = $1 WHERE id = $2;", [liveAddr, targetProperty.id]);
    await updateClient.end();
    console.log(`[Synced] 已自動將當前合約地址 ${liveAddr} 同步至 properties #${targetProperty.id}\n`);
  }

  // 3. 執行繞過後端的真實鏈上轉帳 (50 顆)
  const transferAmount = ethers.parseUnits("50", 18);
  console.log(`[Action] 發起鏈上直連轉帳: 50.0 代幣 -> ${targetUser.username} (${recipientWallet})...`);

  // 確保 Admin 有足夠餘額
  const adminBalance = await token.balanceOf(admin.address);
  if (adminBalance < transferAmount) {
    try { await (await token.mint(admin.address, ethers.parseUnits("1000", 18))).wait(); } catch(e) {}
  }

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
