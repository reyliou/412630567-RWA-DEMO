const hre = require("hardhat");

async function main() {
  const IR_ADDR = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
  const [deployer] = await hre.ethers.getSigners();
  
  // 取得合約實例
  const ir = await hre.ethers.getContractAt("MyIdentityRegistry", IR_ADDR);

  console.log("\n--- 🕵️ ERC-3643 權限診斷報告 ---");
  console.log("當前操作者 (Deployer):", deployer.address);
  
  try {
    const owner = await ir.owner();
    console.log("身分註冊表 (IR) 的 Owner:", owner);

    if (owner === "0x0000000000000000000000000000000000000000") {
      console.log("❌ 警告：Owner 為零地址。合約可能尚未初始化！");
    } else if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("✅ 你就是主人。之前的錯誤可能是因為交易被丟棄或 Gas 不足。");
    } else {
      console.log("❌ 警告：你不是主人。Owner 是其他人或合約！");
    }
  } catch (error) {
    console.log("🚨 無法讀取 Owner，該合約可能不具備 Ownable 屬性或尚未部署成功。");
  }
  console.log("-------------------------------\n");
}

main().catch(console.error);