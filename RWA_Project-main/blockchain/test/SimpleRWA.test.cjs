const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * ERC-3643 (T-REX v4) 合約測試
 *
 * 測試對象：RWA_Project-main/blockchain/contracts/SimpleRWA.sol
 * 測試環境：Hardhat 內建網路（chainId 31337），每個測試以 fixture 快照還原乾淨狀態
 *
 * 這裡驗證的是「鏈上真的擋得住」，而不是後端 API 擋不擋得住 ——
 * 後端的角色檢查若被繞過（例如 JWT 外洩），最後一道防線就是這些合約規則。
 *
 * 佈署流程刻意比照 rwa-backend/src/blockchain/blockchain.service.ts 的
 * setupBlockchain() 與 issueKycClaim()，確保測的是實際會上線的那套設定。
 */

const KYC_TOPIC = 1;           // Topic 1 = KYC 已驗證
const COUNTRY_CODE = 886;      // 台灣
const DECIMALS = 18;

/** 由 admin 簽發一張 KYC Claim 給指定的 Identity 合約（比照 issueKycClaim） */
async function issueKycClaim(identityContract, adminIdentityAddr, adminSigner) {
  const identityAddr = await identityContract.getAddress();
  const claimData = "0x";
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [identityAddr, BigInt(KYC_TOPIC), claimData],
    ),
  );
  const signature = await adminSigner.signMessage(ethers.getBytes(dataHash));
  await (
    await identityContract.addClaim(KYC_TOPIC, 1, adminIdentityAddr, signature, claimData, "")
  ).wait();
}

async function deployTrexFixture() {
  const [admin, investor, outsider] = await ethers.getSigners();

  // ── 身分基礎設施 ────────────────────────────────────────────────
  const irs = await (await ethers.getContractFactory("MyIdentityRegistryStorage")).deploy();
  await (await irs.init()).wait();

  const tir = await (await ethers.getContractFactory("MyTrustedIssuersRegistry")).deploy();
  await (await tir.init()).wait();

  const ctr = await (await ethers.getContractFactory("MyClaimTopicsRegistry")).deploy();
  await (await ctr.init()).wait();
  await (await ctr.addClaimTopic(KYC_TOPIC)).wait();

  const ir = await (await ethers.getContractFactory("MyIdentityRegistry")).deploy();
  await (await irs.addAgent(await ir.getAddress())).wait();
  await (
    await ir.init(await tir.getAddress(), await ctr.getAddress(), await irs.getAddress())
  ).wait();
  await (await ir.addAgent(admin.address)).wait();

  // ── Admin 身分：登記 + 成為 Topic 1 的可信簽發者 + 自簽 KYC ──────
  const IdentityFactory = await ethers.getContractFactory("MyIdentity");
  const adminIdentity = await IdentityFactory.deploy(admin.address, false);
  const adminIdentityAddr = await adminIdentity.getAddress();
  await (await ir.registerIdentity(admin.address, adminIdentityAddr, COUNTRY_CODE)).wait();
  await (await tir.addTrustedIssuer(adminIdentityAddr, [KYC_TOPIC])).wait();
  await issueKycClaim(adminIdentity, adminIdentityAddr, admin);

  // ── 代幣：每個 token 綁定自己的 compliance ──────────────────────
  const compliance = await (await ethers.getContractFactory("MyModularCompliance")).deploy();
  await (await compliance.init()).wait();

  const token = await (await ethers.getContractFactory("MySimpleRWA")).deploy();
  await (
    await token.init(
      await ir.getAddress(),
      await compliance.getAddress(),
      "測試建案",
      "RWA1",
      DECIMALS,
      ethers.ZeroAddress,
    )
  ).wait();
  await (await token.addAgent(admin.address)).wait();
  await (await token.unpause()).wait();

  const totalSupply = ethers.parseUnits("100000", DECIMALS);
  await (await token.mint(admin.address, totalSupply)).wait();

  // ── 投資人：託管模式（管理金鑰給 admin，使用者錢包不需付 gas）────
  const investorIdentity = await IdentityFactory.deploy(admin.address, false);
  await (
    await ir.registerIdentity(investor.address, await investorIdentity.getAddress(), COUNTRY_CODE)
  ).wait();
  await issueKycClaim(investorIdentity, adminIdentityAddr, admin);

  // outsider 刻意「完全不登記」，代表尚未通過 KYC 的外部地址

  return { token, ir, tir, ctr, compliance, adminIdentity, investorIdentity, admin, investor, outsider, totalSupply };
}

describe("SimpleRWA — 合約測試：部署與初始狀態", function () {
  it("代幣的名稱、代號、精度、總發行量應與部署參數一致", async function () {
    const { token, totalSupply } = await loadFixture(deployTrexFixture);
    expect(await token.name()).to.equal("測試建案");
    expect(await token.symbol()).to.equal("RWA1");
    expect(await token.decimals()).to.equal(DECIMALS);
    expect(await token.totalSupply()).to.equal(totalSupply);
  });

  it("鑄造出的全部代幣應在 admin 錢包中，作為未售出庫存", async function () {
    const { token, admin, totalSupply } = await loadFixture(deployTrexFixture);
    expect(await token.balanceOf(admin.address)).to.equal(totalSupply);
  });

  it("代幣應綁定正確的 IdentityRegistry 與 Compliance", async function () {
    const { token, ir, compliance } = await loadFixture(deployTrexFixture);
    expect(await token.identityRegistry()).to.equal(await ir.getAddress());
    expect(await token.compliance()).to.equal(await compliance.getAddress());
  });
});

describe("SimpleRWA — 合約測試：KYC 合規閘門（ERC-3643 核心）", function () {
  it("已登記身分且持有 KYC Claim 的地址，應被 IdentityRegistry 判定為已驗證", async function () {
    const { ir, investor } = await loadFixture(deployTrexFixture);
    expect(await ir.isVerified(investor.address)).to.equal(true);
  });

  it("完全未登記的地址應被判定為未驗證", async function () {
    const { ir, outsider } = await loadFixture(deployTrexFixture);
    expect(await ir.contains(outsider.address)).to.equal(false);
    expect(await ir.isVerified(outsider.address)).to.equal(false);
  });

  it("轉帳給已通過 KYC 的投資人應該成功，且雙方餘額正確變動", async function () {
    const { token, admin, investor } = await loadFixture(deployTrexFixture);
    const amount = ethers.parseUnits("500", DECIMALS);
    const before = await token.balanceOf(admin.address);

    await expect(token.transfer(investor.address, amount)).to.not.be.reverted;

    expect(await token.balanceOf(investor.address)).to.equal(amount);
    expect(await token.balanceOf(admin.address)).to.equal(before - amount);
  });

  it("🔒 轉帳給未通過 KYC 的地址必須被鏈上拒絕（就算後端權限被繞過也擋得住）", async function () {
    const { token, outsider } = await loadFixture(deployTrexFixture);
    const amount = ethers.parseUnits("500", DECIMALS);

    await expect(token.transfer(outsider.address, amount)).to.be.reverted;
    expect(await token.balanceOf(outsider.address)).to.equal(0n);
  });

  it("🔒 未通過 KYC 的地址也不能被鑄造代幣", async function () {
    const { token, outsider } = await loadFixture(deployTrexFixture);
    await expect(token.mint(outsider.address, ethers.parseUnits("1", DECIMALS))).to.be.reverted;
  });

  it("身分登記被撤銷後，該地址應立即無法再收到代幣", async function () {
    const { token, ir, investor } = await loadFixture(deployTrexFixture);
    const amount = ethers.parseUnits("100", DECIMALS);

    await expect(token.transfer(investor.address, amount)).to.not.be.reverted;

    await (await ir.deleteIdentity(investor.address)).wait();
    expect(await ir.isVerified(investor.address)).to.equal(false);

    await expect(token.transfer(investor.address, amount)).to.be.reverted;
  });
});

describe("SimpleRWA — 權限測試：agent 與 owner 角色", function () {
  it("admin 應具備 agent 身分，一般投資人不應具備", async function () {
    const { token, admin, investor } = await loadFixture(deployTrexFixture);
    expect(await token.isAgent(admin.address)).to.equal(true);
    expect(await token.isAgent(investor.address)).to.equal(false);
  });

  it("🔒 非 agent 呼叫 mint() 應被拒絕", async function () {
    const { token, investor } = await loadFixture(deployTrexFixture);
    await expect(
      token.connect(investor).mint(investor.address, ethers.parseUnits("1000", DECIMALS)),
    ).to.be.reverted;
  });

  it("🔒 非 agent 呼叫 pause() 應被拒絕", async function () {
    const { token, investor } = await loadFixture(deployTrexFixture);
    await expect(token.connect(investor).pause()).to.be.reverted;
    expect(await token.paused()).to.equal(false);
  });

  it("🔒 非 agent 呼叫 forcedTransfer() 應被拒絕（賣出流程依賴此權限）", async function () {
    const { token, admin, investor } = await loadFixture(deployTrexFixture);
    await (await token.transfer(investor.address, ethers.parseUnits("100", DECIMALS))).wait();

    await expect(
      token
        .connect(investor)
        .forcedTransfer(investor.address, admin.address, ethers.parseUnits("100", DECIMALS)),
    ).to.be.reverted;
  });

  it("agent 可用 forcedTransfer 收回投資人代幣，使用者錢包無需持有 ETH 付 gas", async function () {
    const { token, admin, investor } = await loadFixture(deployTrexFixture);
    const amount = ethers.parseUnits("100", DECIMALS);
    await (await token.transfer(investor.address, amount)).wait();

    await expect(token.forcedTransfer(investor.address, admin.address, amount)).to.not.be.reverted;
    expect(await token.balanceOf(investor.address)).to.equal(0n);
  });

  it("🔒 非 owner 不能新增 agent", async function () {
    const { token, investor, outsider } = await loadFixture(deployTrexFixture);
    await expect(token.connect(investor).addAgent(outsider.address)).to.be.reverted;
  });
});

describe("SimpleRWA — 負向測試：暫停與餘額邊界", function () {
  it("pause() 之後所有轉帳都應被拒絕（技術端緊急煞車）", async function () {
    const { token, investor } = await loadFixture(deployTrexFixture);
    await (await token.pause()).wait();
    expect(await token.paused()).to.equal(true);

    await expect(token.transfer(investor.address, ethers.parseUnits("100", DECIMALS))).to.be
      .reverted;
  });

  it("unpause() 之後轉帳應恢復正常", async function () {
    const { token, investor } = await loadFixture(deployTrexFixture);
    const amount = ethers.parseUnits("100", DECIMALS);

    await (await token.pause()).wait();
    await (await token.unpause()).wait();
    expect(await token.paused()).to.equal(false);

    await expect(token.transfer(investor.address, amount)).to.not.be.reverted;
    expect(await token.balanceOf(investor.address)).to.equal(amount);
  });

  it("重複 pause() 應被拒絕，避免狀態被誤改", async function () {
    const { token } = await loadFixture(deployTrexFixture);
    await (await token.pause()).wait();
    await expect(token.pause()).to.be.reverted;
  });

  it("轉帳金額超過餘額時應被拒絕", async function () {
    const { token, admin, investor, totalSupply } = await loadFixture(deployTrexFixture);
    await expect(token.transfer(investor.address, totalSupply + 1n)).to.be.reverted;
    expect(await token.balanceOf(admin.address)).to.equal(totalSupply);
  });

  it("投資人賣超過自己持有的數量時應被拒絕", async function () {
    const { token, admin, investor } = await loadFixture(deployTrexFixture);
    const held = ethers.parseUnits("100", DECIMALS);
    await (await token.transfer(investor.address, held)).wait();

    await expect(token.forcedTransfer(investor.address, admin.address, held + 1n)).to.be.reverted;
    expect(await token.balanceOf(investor.address)).to.equal(held);
  });
});
