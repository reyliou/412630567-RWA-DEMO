const hre = require("hardhat");

async function main() {
  console.log("🚀 [全體出動] 開始部署具現化的 ERC-3643 系統...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("👑 超級管理員:", deployer.address);

  // 1. 部署 RegistryStorage
  const Storage = await hre.ethers.getContractFactory("MyIdentityRegistryStorage");
  const storage = await Storage.deploy();
  await storage.waitForDeployment();
  const storageAddr = await storage.getAddress();
  console.log("✅ 1. Storage:", storageAddr);

  // 2. 部署 TrustedIssuers
  const Issuers = await hre.ethers.getContractFactory("MyTrustedIssuersRegistry");
  const issuers = await Issuers.deploy();
  await issuers.waitForDeployment();
  const issuersAddr = await issuers.getAddress();
  console.log("✅ 2. Issuers:", issuersAddr);

  // 3. 部署 ClaimTopics
  const Topics = await hre.ethers.getContractFactory("MyClaimTopicsRegistry");
  const topics = await Topics.deploy();
  await topics.waitForDeployment();
  const topicsAddr = await topics.getAddress();
  console.log("✅ 3. Topics:", topicsAddr);

  // 4. 部署 Identity 範本
  const Identity = await hre.ethers.getContractFactory("MyIdentity");
  const identityImpl = await Identity.deploy(deployer.address, true);
  await identityImpl.waitForDeployment();
  const identityAddr = await identityImpl.getAddress();
  console.log("✅ 4. Identity Template:", identityAddr);

  // 5. 部署 IdentityRegistry (自動偵測參數數量)
  const IdentityRegistry = await hre.ethers.getContractFactory("MyIdentityRegistry");
  let identityRegistry;
  
  const params = [issuersAddr, topicsAddr, storageAddr, identityAddr];
  
  for (let i = 4; i >= 0; i--) {
    try {
      console.log(`嘗試使用 ${i} 個參數部署...`);
      const currentParams = params.slice(0, i);
      identityRegistry = await IdentityRegistry.deploy(...currentParams);
      await identityRegistry.waitForDeployment();
      if (identityRegistry) break;
    } catch (e) {
      if (i === 0) throw new Error("所有參數組合都失敗了，請檢查合約源碼。");
      continue;
    }
  }
  
  const irAddr = await identityRegistry.getAddress();
  console.log("✅ 5. IdentityRegistry:", irAddr);
  
  // 6. 部署 ModularCompliance
  const Compliance = await hre.ethers.getContractFactory("MyModularCompliance");
  const compliance = await Compliance.deploy();
  await compliance.waitForDeployment();
  const complianceAddr = await compliance.getAddress();
  console.log("✅ 6. Compliance:", complianceAddr);

  // 7. 部署 SimpleRWA 代幣
  const SimpleRWA = await hre.ethers.getContractFactory("MySimpleRWA");
  const rwaToken = await SimpleRWA.deploy();
  await rwaToken.waitForDeployment();
  const tokenAddress = await rwaToken.getAddress();
  console.log("✅ 7. SimpleRWA Token:", tokenAddress);

  // 初始化互鎖
  console.log("\n⚙️ 執行系統綁定...");
  await rwaToken.init(
    irAddr, 
    complianceAddr, 
    "Tainan Estate", 
    "TRET", 
    18, 
    "0x0000000000000000000000000000000000000000"
  );

  console.log("\n===============================");
  console.log("🎉 任務達成！地址清單如下：");
  console.log("TOKEN_ADDR=" + tokenAddress);
  console.log("IDENTITY_REG_ADDR=" + irAddr);
  console.log("COMPLIANCE_ADDR=" + complianceAddr);
  console.log("===============================\n");
}

main().catch((error) => {
  console.error("🚨 部署失敗:", error);
  process.exitCode = 1;
});