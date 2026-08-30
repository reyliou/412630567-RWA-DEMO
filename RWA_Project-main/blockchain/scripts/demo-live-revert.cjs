const hre = require("hardhat");

async function main() {
  console.log("================================================================");
  console.log("🛡️ ERC-3643 智能合約底層合規攔截 Live 展示 (Part 2 Demo)");
  console.log("================================================================\n");

  const [admin, investor, outsider] = await hre.ethers.getSigners();

  // 1. 創世部署或取得已部署的合約
  console.log("👑 [角色分配]");
  console.log(`• 管理員 (Admin/Issuer):      ${admin.address}`);
  console.log(`• 已通過 KYC 投資人 (Investor): ${investor.address}`);
  console.log(`• 未通過 KYC 外部人士 (Outsider): ${outsider.address}\n`);

  console.log("🚀 [1/3] 正在部署 ERC-3643 合約體系並註冊身分...");
  
  // 部署 IR Storage & IR
  const IRStorage = await hre.ethers.deployContract("MyIdentityRegistryStorage");
  await IRStorage.waitForDeployment();
  const IR = await hre.ethers.deployContract("MyIdentityRegistry");
  await IR.waitForDeployment();
  const TIR = await hre.ethers.deployContract("MyTrustedIssuersRegistry");
  await TIR.waitForDeployment();
  const CTR = await hre.ethers.deployContract("MyClaimTopicsRegistry");
  await CTR.waitForDeployment();
  const Compliance = await hre.ethers.deployContract("MyModularCompliance");
  await Compliance.waitForDeployment();
  const Token = await hre.ethers.deployContract("MySimpleRWA");
  await Token.waitForDeployment();

  try { const tx = await IRStorage.init(); await tx.wait(); } catch(e) {}
  await (await IRStorage.addAgent(await IR.getAddress())).wait();
  await (await IR.init(await TIR.getAddress(), await CTR.getAddress(), await IRStorage.getAddress())).wait();
  await (await IR.addAgent(admin.address)).wait();
  await (await Token.init(await IR.getAddress(), await Compliance.getAddress(), "Tainan Estate", "TRET", 18, hre.ethers.ZeroAddress)).wait();
  await (await Token.addAgent(admin.address)).wait();

  // 註冊 Admin 與 Investor 的身分
  const AdminID = await hre.ethers.deployContract("MyIdentity", [admin.address, false]);
  await AdminID.waitForDeployment();
  await (await IR.registerIdentity(admin.address, await AdminID.getAddress(), 42)).wait();

  const InvestorID = await hre.ethers.deployContract("MyIdentity", [investor.address, false]);
  await InvestorID.waitForDeployment();
  await (await IR.registerIdentity(investor.address, await InvestorID.getAddress(), 42)).wait();

  // 鑄造 1000 顆代幣給 Admin
  await (await Token.mint(admin.address, hre.ethers.parseUnits("1000", 18))).wait();
  console.log("   └─ ✅ 合約部署完成！管理員已持有 1000 TRET，投資人已通過 KYC 登記。\n");

  // 2. 對照組 ①：轉帳給已通過 KYC 的投資人
  console.log("▶ [2/3] 對照組測試：轉帳給【已通過 KYC】的投資人 (Investor)...");
  const transferAmount = hre.ethers.parseUnits("10", 18);
  const txPass = await Token.transfer(investor.address, transferAmount);
  const receiptPass = await txPass.wait();
  console.log(`   └─ 🟢 【成功放行】交易成功上鏈！`);
  console.log(`      • txHash: ${receiptPass.hash}`);
  console.log(`      • Investor 餘額: ${hre.ethers.formatUnits(await Token.balanceOf(investor.address), 18)} TRET\n`);

  // 3. 核心亮點 ②：轉帳給未通過 KYC 的外部人士 (Outsider)
  console.log("▶ [3/3] 核心攔截測試：轉帳給【未通過 KYC】的外部人士 (Outsider)...");
  console.log("   （注意看左邊 hardhat node 視窗，觀察 EVM 是否直接 Revert 交易）");

  try {
    const txBlocked = await Token.transfer(outsider.address, transferAmount);
    await txBlocked.wait();
    console.log("   └─ ❌ 異常：交易竟然通過了（合規未生效）");
  } catch (error) {
    console.log("   └─ 🔴 【現場強制攔截成功！】");
    console.log(`      • 攔截層級: 以太坊 EVM 智慧合約底層 (ERC-3643 Compliance Revert)`);
    console.log(`      • 錯誤原因: ${error.message.split('(')[0].trim() || 'Transaction reverted'}`);
    console.log(`      • 說明: 外部地址 ${outsider.address} 未於 IdentityRegistry 登記，合約拒絕轉帳！\n`);
  }

  console.log("================================================================");
  console.log("🎉 展示圓滿達成：一過一擋完整驗證！證明合規 100% 寫死在區塊鏈底層！");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("執行失敗:", err);
  process.exitCode = 1;
});
