const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 開始 RWA 全系統創世部署 (存儲層修復版)...");

  // --- 1. 部署所有組件 ---
  const IRStorage = await hre.ethers.deployContract("MyIdentityRegistryStorage");
  await IRStorage.waitForDeployment();
  const IRS_ADDR = await IRStorage.getAddress();

  const IR = await hre.ethers.deployContract("MyIdentityRegistry");
  await IR.waitForDeployment();
  const IR_ADDR = await IR.getAddress();

  // ... (其他合約部署保持不變：TIR, CTR, Compliance, Token, MyID)
  const TrustedIssuers = await hre.ethers.deployContract("MyTrustedIssuersRegistry");
  await TrustedIssuers.waitForDeployment();
  const TIR_ADDR = await TrustedIssuers.getAddress();

  const ClaimTopics = await hre.ethers.deployContract("MyClaimTopicsRegistry");
  await ClaimTopics.waitForDeployment();
  const CTR_ADDR = await ClaimTopics.getAddress();

  const Compliance = await hre.ethers.deployContract("MyModularCompliance");
  await Compliance.waitForDeployment();
  const COMP_ADDR = await Compliance.getAddress();

  const Token = await hre.ethers.deployContract("MySimpleRWA");
  await Token.waitForDeployment();
  const TOKEN_ADDR = await Token.getAddress();

  const MyID = await hre.ethers.deployContract("MyIdentity", [deployer.address, false]);
  await MyID.waitForDeployment();
  const MY_ID_ADDR = await MyID.getAddress();

  console.log("✅ 所有合約部署完成！");

  // 💡 [核心修正]：先初始化 Storage，否則它沒有 Owner
  console.log("⚙️ 正在初始化 Storage 權限...");
  // 某些版本叫 init()，某些叫 initialize()。根據你的編譯結果，這裡通常是 init()
  try {
    const tx0 = await IRStorage.init(); 
    await tx0.wait();
    console.log("✅ Storage 初始化成功，Owner 已設定。");
  } catch (e) {
    console.log("⚠️ Storage 可能不需要單獨 init 或函式名不同，嘗試繼續...");
  }

  // --- 2. 授權 Storage ---
  console.log("🔑 正在授權 IR 合約訪問 Storage...");
  const tx1 = await IRStorage.addAgent(IR_ADDR); 
  await tx1.wait();

  // --- 3. 初始化 IR ---
  console.log("⚙️ 正在初始化 IR...");
  const tx3 = await IR.init(TIR_ADDR, CTR_ADDR, IRS_ADDR);
  await tx3.wait();

  // ... (其餘授權與註冊身分、印錢的邏輯保持不變)
  
  console.log("🔑 授權管理員為 IR Agent...");
  const tx4 = await IR.addAgent(deployer.address);
  await tx4.wait();

  console.log("⚙️ 正在初始化 Token...");
  const tx5 = await Token.init(IR_ADDR, COMP_ADDR, "Tainan Estate", "TRET", 18, hre.ethers.ZeroAddress);
  await tx5.wait();

  console.log("🔑 授權管理員為 Token Agent...");
  const tx6 = await Token.addAgent(deployer.address);
  await tx6.wait();

  console.log("🆔 正在註冊管理員身分...");
  const tx7 = await IR.registerIdentity(deployer.address, MY_ID_ADDR, 42);
  await tx7.wait();

  console.log("💰 正在鑄造 1000 TRET...");
  const tx8 = await Token.mint(deployer.address, hre.ethers.parseUnits("1000", 18));
  await tx8.wait();

  console.log("\n=========================================");
  console.log("🎉 創世成功！請更新 NestJS .env：");
  console.log(`TOKEN_ADDR=${TOKEN_ADDR}`);
  console.log(`IDENTITY_REG_ADDR=${IR_ADDR}`);
  console.log("=========================================\n");
}

main().catch((error) => {
  console.error("🚨 腳本執行出錯:", error.message);
  process.exitCode = 1;
});