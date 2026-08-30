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
  const [admin, investor, outsider] = await ethers.getSigners();

  console.log("[Setup] 正在部署 ERC-3643 基礎設施與 IdentityRegistry...");

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

  const IdentityFactory = await ethers.getContractFactory("MyIdentity");
  const adminIdentity = await IdentityFactory.deploy(admin.address, false);
  const adminIdentityAddr = await adminIdentity.getAddress();
  await (await ir.registerIdentity(admin.address, adminIdentityAddr, COUNTRY_CODE)).wait();
  await (await tir.addTrustedIssuer(adminIdentityAddr, [KYC_TOPIC])).wait();
  await issueKycClaim(adminIdentity, adminIdentityAddr, admin);

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
  await (await token.unpause()).wait();

  const investorIdentity = await IdentityFactory.deploy(admin.address, false);
  await (
    await ir.registerIdentity(investor.address, await investorIdentity.getAddress(), COUNTRY_CODE)
  ).wait();
  await issueKycClaim(investorIdentity, adminIdentityAddr, admin);

  const totalSupply = ethers.parseUnits("100000", 18);
  await (await token.mint(admin.address, totalSupply)).wait();

  console.log(`[Setup] 完成: Token=${await token.getAddress()}, IR=${await ir.getAddress()}`);
  console.log(`[Accounts] Admin=${admin.address}`);
  console.log(`           Investor=${investor.address} (KYC: YES)`);
  console.log(`           Outsider=${outsider.address} (KYC: NO)\n`);

  // 測試 1: 轉帳給已通過 KYC 的投資人
  console.log(`[Test 1] 轉帳 10 XYCJ -> Investor (${investor.address})...`);
  const transferAmount = ethers.parseUnits("10", 18);
  const txPass = await token.transfer(investor.address, transferAmount);
  const receiptPass = await txPass.wait();
  console.log(`[Test 1 Result] SUCCESS: txHash=${receiptPass.hash}, Investor Balance=${ethers.formatUnits(await token.balanceOf(investor.address), 18)} XYCJ\n`);

  // 測試 2: 轉帳給未通過 KYC 的外部帳戶
  console.log(`[Test 2] 轉帳 10 XYCJ -> Outsider (${outsider.address})...`);
  try {
    const txBlocked = await token.transfer(outsider.address, transferAmount);
    await txBlocked.wait();
    console.log(`[Test 2 Result] UNEXPECTED_SUCCESS: Transfer allowed without KYC\n`);
  } catch (error) {
    console.log(`[Test 2 Result] REVERTED: ${error.message.split('(')[0].trim() || 'Transaction reverted'}`);
    console.log(`[Reason] Receiver not verified in IdentityRegistry (ERC-3643 Compliance Revert)\n`);
  }
}

main().catch((err) => {
  console.error("[Fatal Error]:", err.message);
  process.exitCode = 1;
});
