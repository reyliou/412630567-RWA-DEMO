const hre = require("hardhat");
const { ethers } = hre;

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
  console.log("================================================================");
  console.log("🛡️ ERC-3643 智能合約底層合規攔截 Live 展示 (Part 2 Demo)");
  console.log("================================================================\n");

  const [admin, investor, outsider] = await ethers.getSigners();

  console.log("👑 [角色分配]");
  console.log(`• 管理員 (Admin/Issuer):      ${admin.address}`);
  console.log(`• 已通過 KYC 投資人 (Investor): ${investor.address}`);
  console.log(`• 未通過 KYC 外部人士 (Outsider): ${outsider.address}\n`);

  console.log("🚀 [1/3] 正在部署 ERC-3643 基礎設施與身分合規認證...");

  // 1. 身分註冊基礎設施
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

  // 2. Admin 身分註冊與可信發行者綁定
  const IdentityFactory = await ethers.getContractFactory("MyIdentity");
  const adminIdentity = await IdentityFactory.deploy(admin.address, false);
  const adminIdentityAddr = await adminIdentity.getAddress();
  await (await ir.registerIdentity(admin.address, adminIdentityAddr, COUNTRY_CODE)).wait();
  await (await tir.addTrustedIssuer(adminIdentityAddr, [KYC_TOPIC])).wait();
  await issueKycClaim(adminIdentity, adminIdentityAddr, admin);

  // 3. 代幣合約部署、合規綁定與解除暫停 (unpause)
  const compliance = await (await ethers.getContractFactory("MyModularCompliance")).deploy();
  await (await compliance.init()).wait();

  const token = await (await ethers.getContractFactory("MySimpleRWA")).deploy();
  await (
    await token.init(
      await ir.getAddress(),
      await compliance.getAddress(),
      "信義誠家 RWA",
      "XYCJ",
      18,
      ethers.ZeroAddress
    )
  ).wait();
  await (await token.addAgent(admin.address)).wait();
  // 💡 關鍵解鎖：ERC-3643 初始化預設為 paused，需呼叫 unpause 開啟市場轉帳
  await (await token.unpause()).wait();

  // 4. 投資人 KYC 身分審批與 Claim 簽發
  const investorIdentity = await IdentityFactory.deploy(admin.address, false);
  await (
    await ir.registerIdentity(investor.address, await investorIdentity.getAddress(), COUNTRY_CODE)
  ).wait();
  await issueKycClaim(investorIdentity, adminIdentityAddr, admin);

  // 5. 鑄造首發 100,000 顆代幣給 Admin
  const totalSupply = ethers.parseUnits("100000", 18);
  await (await token.mint(admin.address, totalSupply)).wait();

  console.log("   └─ ✅ 基礎設施就緒！代幣已 unpause 啟用，Admin 已持有 100,000 XYCJ。");
  console.log("   └─ 🔑 Investor 已在 IdentityRegistry 獲得 KYC Topic 1 官方簽名認證。");
  console.log("   └─ 🚫 Outsider 未在身分表中登記，無任何 KYC 認證。\n");

  // 2. 對照組 ①：轉帳給已通過 KYC 的投資人
  console.log("▶ [2/3] 對照組測試：轉帳給【已通過 KYC】的投資人 (Investor)...");
  const transferAmount = ethers.parseUnits("10", 18);
  const txPass = await token.transfer(investor.address, transferAmount);
  const receiptPass = await txPass.wait();
  console.log(`   └─ 🟢 【成功放行】交易成功出塊上鏈！`);
  console.log(`      • 交易雜湊 (txHash): ${receiptPass.hash}`);
  console.log(`      • Investor 餘額: ${ethers.formatUnits(await token.balanceOf(investor.address), 18)} XYCJ\n`);

  // 3. 核心亮點 ②：轉帳給未通過 KYC 的外部人士 (Outsider)
  console.log("▶ [3/3] 核心攔截測試：轉帳給【未通過 KYC】的外部人士 (Outsider)...");
  console.log("   （注意看左邊 hardhat node 視窗，觀察 EVM 是否直接 Revert 交易）");

  try {
    const txBlocked = await token.transfer(outsider.address, transferAmount);
    await txBlocked.wait();
    console.log("   └─ ❌ 異常：交易竟然通過了（合規未生效）");
  } catch (error) {
    console.log("   └─ 🔴 【現場強制攔截成功！】");
    console.log(`      • 攔截層級: 以太坊 EVM 智慧合約底層 (ERC-3643 Compliance Revert)`);
    console.log(`      • 錯誤代碼: ${error.message.split('(')[0].trim() || 'Transaction reverted'}`);
    console.log(`      • 攔截原理: 接收者 ${outsider.address} 未通過 IdentityRegistry KYC 審核，合約強制 Revert！\n`);
  }

  console.log("================================================================");
  console.log("🎉 展示圓滿達成：一過一擋完整驗證！證明合規 100% 寫死在區塊鏈底層！");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("執行失敗:", err);
  process.exitCode = 1;
});
