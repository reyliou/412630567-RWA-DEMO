const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  const TOKEN_ADDR = "0x09635F643e140090A9A8Dcd712eD6285858ceBef";
  const IR_ADDR = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
  const COMPLIANCE_ADDR = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const token = await hre.ethers.getContractAt("MySimpleRWA", TOKEN_ADDR);

  console.log("🚀 執行 Token 初始化 (修正參數順序版)...");

  try {
    // 💡 關鍵修正：依照官方 T-REX v4 的參數順序：
    // 1. _identityRegistry (地址)
    // 2. _compliance (地址)
    // 3. _name (字串)
    // 4. _symbol (字串)
    // 5. _decimals (數字)
    // 6. _onchainID (地址)
    const initData = token.interface.encodeFunctionData("init", [
      IR_ADDR,                // 1
      COMPLIANCE_ADDR,        // 2
      "Tainan Estate",        // 3
      "TRET",                 // 4
      18,                     // 5
      ZERO_ADDRESS            // 6
    ]);

    console.log("正在發送初始化交易...");
    const tx = await deployer.sendTransaction({
      to: TOKEN_ADDR,
      data: initData
    });

    await tx.wait();
    console.log("✅ Token 初始化成功！");

    // 授權 Agent
    console.log("正在授權管理員為 Agent...");
    const agentData = token.interface.encodeFunctionData("addAgent", [deployer.address]);
    const txAgent = await deployer.sendTransaction({
      to: TOKEN_ADDR,
      data: agentData
    });
    await txAgent.wait();
    console.log("✅ Agent 授權成功！");

  } catch (error) {
    console.error("🚨 執行失敗。");
    console.error("錯誤詳細資訊:", error.message);
  }
}

main().catch(console.error);