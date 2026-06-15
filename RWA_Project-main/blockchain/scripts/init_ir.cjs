const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  // 你的合約地址
  const IR_ADDR = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
  const TRUSTED_ISSUER_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const CLAIM_TOPICS_ADDR = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const IDENTITY_STORAGE_ADDR = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  // 取得 IdentityRegistry 實例
  const ir = await hre.ethers.getContractAt("MyIdentityRegistry", IR_ADDR);

  console.log("🚀 正在執行 IdentityRegistry 初始化 (使用官方 init 函式)...");

  try {
    // 官方 T-REX v4 函式名稱是 init
    // 參數順序: _trustedIssuersRegistry, _claimTopicsRegistry, _identityStorage
    const tx = await ir.init(
      TRUSTED_ISSUER_ADDR,
      CLAIM_TOPICS_ADDR,
      IDENTITY_STORAGE_ADDR
    );
    
    console.log("⏳ 正在等待交易上鏈...");
    await tx.wait();
    
    console.log("✅ 初始化完成！");

    const newOwner = await ir.owner();
    console.log("👑 目前 Owner 已設定為:", newOwner);
  } catch (error) {
    console.error("🚨 執行失敗。請確認地址是否正確或合約是否已被初始化過。");
    console.error("錯誤原因:", error.reason || error.message);
  }
}

main().catch(console.error);