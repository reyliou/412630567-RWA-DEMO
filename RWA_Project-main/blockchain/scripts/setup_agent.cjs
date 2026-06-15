const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const TOKEN_ADDR = "0x09635F643e140090A9A8Dcd712eD6285858ceBef";
  const IR_ADDR = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";

  console.log("👑 目前操作者:", deployer.address);

  // 1. 代幣合約授權
  const token = await hre.ethers.getContractAt("MySimpleRWA", TOKEN_ADDR);
  try {
    console.log("正在嘗試代幣合約授權...");
    const tx1 = await token.addAgent(deployer.address);
    await tx1.wait();
    console.log("✅ 1. 代幣合約 Agent 授權成功");
  } catch (e) {
    console.log("⚠️ 代幣合約 Agent 可能已存在或權限受限:", e.reason || e.message);
  }

  // 2. 身分註冊表授權 (重點修正)
  const ir = await hre.ethers.getContractAt("MyIdentityRegistry", IR_ADDR);
  const irOwner = await ir.owner();
  console.log("🕵️ 身分註冊表目前的 Owner 是:", irOwner);

  if (irOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ 警告：你不是 IR 的 Owner，無法直接 addAgent。");
    console.log("💡 解決方案：嘗試透過 Token 合約來操作（如果 Token 是 IR 的 Agent）。");
  } else {
    console.log("正在嘗試身分註冊表授權...");
    const tx2 = await ir.addAgent(deployer.address);
    await tx2.wait();
    console.log("✅ 2. 身分註冊表 Agent 授權成功");
  }
}

main().catch((error) => {
  console.error("🚨 授權失敗:", error);
  process.exitCode = 1;
});