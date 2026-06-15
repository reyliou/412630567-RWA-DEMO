import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { RwaTransaction } from '../transaction.entity';
import { Property } from '../entities/property.entity';
import { User } from '../entities/user.entity';
import { BlockchainConfig } from '../entities/blockchain-config.entity';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private adminWallet: ethers.Wallet;
  private adminAddress: string;
  private isProviderReady = false;
  private artifactsDir: string;

  constructor(
    @InjectRepository(RwaTransaction)
    private rwaRepo: Repository<RwaTransaction>,
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(BlockchainConfig)
    private configRepo: Repository<BlockchainConfig>,
  ) {}

  onModuleInit() {
    // Artifacts are compiled by Hardhat; locate them relative to rwa-backend/
    this.artifactsDir = path.join(
      process.cwd(),
      '..',
      'blockchain',
      'artifacts',
      'contracts',
      'SimpleRWA.sol',
    );

    try {
      const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
      const adminKey =
        process.env.ADMIN_KEY ||
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      const baseWallet = new ethers.Wallet(adminKey, this.provider);
      this.adminAddress = baseWallet.address;
      this.adminWallet = new ethers.NonceManager(baseWallet) as unknown as ethers.Wallet;
      this.isProviderReady = true;
      this.logger.log(`Blockchain provider initialised → ${rpcUrl}`);
    } catch {
      this.logger.warn('Blockchain provider init failed — Hardhat may not be running.');
    }
  }

  // ──────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────

  private loadArtifact(contractName: string): { abi: any[]; bytecode: string } {
    const filePath = path.join(this.artifactsDir, `${contractName}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `找不到合約 artifact: ${filePath}\n請先執行: cd ../blockchain && npx hardhat compile`,
      );
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  private async deployContract(contractName: string, ...args: any[]): Promise<ethers.Contract> {
    const { abi, bytecode } = this.loadArtifact(contractName);
    const factory = new ethers.ContractFactory(abi, bytecode, this.adminWallet);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    return contract as unknown as ethers.Contract;
  }

  private getContract(contractName: string, address: string, signer?: ethers.Signer): ethers.Contract {
    const { abi } = this.loadArtifact(contractName);
    return new ethers.Contract(address, abi, signer ?? this.adminWallet);
  }

  private async getConfig(key: string): Promise<string | null> {
    const row = await this.configRepo.findOne({ where: { key } });
    return row?.value ?? null;
  }

  private async setConfig(key: string, value: string) {
    await this.configRepo.save({ key, value });
  }

  async isNodeReachable(): Promise<boolean> {
    if (!this.isProviderReady) return false;
    try {
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  artifactsExist(): boolean {
    return fs.existsSync(this.artifactsDir);
  }

  // ──────────────────────────────────────────
  // Setup: deploy infra + one token per property
  // ──────────────────────────────────────────

  async setupBlockchain() {
    if (!this.isProviderReady || !(await this.isNodeReachable())) {
      throw new Error('Hardhat 節點未啟動。請先執行: cd ../blockchain && npx hardhat node');
    }
    if (!this.artifactsExist()) {
      throw new Error('合約未編譯。請先執行: cd ../blockchain && npx hardhat compile');
    }

    this.logger.log('🚀 開始部署 ERC-3643 基礎設施...');
    this.logger.log(`Admin wallet: ${this.adminAddress}`);

    // 1. IdentityRegistryStorage — init() 設 owner = admin
    const irs = await this.deployContract('MyIdentityRegistryStorage');
    const irsAddr = await irs.getAddress();
    await (await irs.init()).wait();
    this.logger.log(`✅ IdentityRegistryStorage: ${irsAddr}`);

    // 2. TrustedIssuersRegistry & ClaimTopicsRegistry — 各自 init() 設 owner = admin
    const tir = await this.deployContract('MyTrustedIssuersRegistry');
    const tirAddr = await tir.getAddress();
    await (await tir.init()).wait();

    const ctr = await this.deployContract('MyClaimTopicsRegistry');
    const ctrAddr = await ctr.getAddress();
    await (await ctr.init()).wait();
    // Topic 1 = KYC 已驗證，所有代幣轉帳都要求持有此 Claim
    await (await ctr.addClaimTopic(1)).wait();
    this.logger.log(`✅ TrustedIssuers: ${tirAddr} | ClaimTopics: ${ctrAddr} (Topic 1 已設定)`);

    // 3. IdentityRegistry
    const ir = await this.deployContract('MyIdentityRegistry');
    const irAddr = await ir.getAddress();
    await (await irs.addAgent(irAddr)).wait();
    await (await ir.init(tirAddr, ctrAddr, irsAddr)).wait();
    await (await ir.addAgent(this.adminAddress)).wait();
    this.logger.log(`✅ IdentityRegistry: ${irAddr}`);

    // 4. ModularCompliance — init() 設 owner = admin
    const compliance = await this.deployContract('MyModularCompliance');
    const complianceAddr = await compliance.getAddress();
    await (await compliance.init()).wait();
    this.logger.log(`✅ ModularCompliance: ${complianceAddr}`);

    // 5. Admin identity — 部署、登記 IR、成為 TIR 的可信簽發者
    const adminId = await this.deployContract('MyIdentity', this.adminAddress, false);
    const adminIdentityAddr = await adminId.getAddress();
    await (await ir.registerIdentity(this.adminAddress, adminIdentityAddr, 886)).wait();
    // 將 admin identity 加入 TIR，宣告其對 Topic 1 有簽發資格
    await (await tir.addTrustedIssuer(adminIdentityAddr, [1])).wait();
    // Admin 自簽 KYC Claim（賣出時 to=adminWallet，合約會驗證 admin 是否 isVerified）
    const adminClaimData = '0x';
    const adminDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'bytes'],
        [adminIdentityAddr, 1n, adminClaimData],
      ),
    );
    const adminSig = await this.adminWallet.signMessage(ethers.getBytes(adminDataHash));
    await (await adminId.addClaim(1, 1, adminIdentityAddr, adminSig, adminClaimData, '')).wait();
    this.logger.log(`✅ Admin identity: ${adminIdentityAddr} (TIR 可信簽發者 + 自簽 KYC Claim)`);

    // 6. Persist shared addresses
    await this.setConfig('ir_address', irAddr);
    await this.setConfig('compliance_address', complianceAddr);
    await this.setConfig('admin_identity_address', adminIdentityAddr);

    // 7. Deploy one ERC-3643 token per property (each token gets its own compliance)
    const properties = await this.propertyRepo.find();
    const deployedTokens: any[] = [];

    for (const property of properties) {
      this.logger.log(`🏗️ 正在部署 ${property.title} 的代幣...`);
      const symbol = `RWA${property.id}`;

      // 每個 token 獨立一個 compliance，避免 bindToken 衝突
      const tokenCompliance = await this.deployContract('MyModularCompliance');
      const tokenComplianceAddr = await tokenCompliance.getAddress();
      await (await tokenCompliance.init()).wait();

      const token = await this.deployContract('MySimpleRWA');
      const tokenAddr = await token.getAddress();

      await (await token.init(irAddr, tokenComplianceAddr, property.title, symbol, 18, ethers.ZeroAddress)).wait();
      await (await token.addAgent(this.adminAddress)).wait();
      await (await token.unpause()).wait();

      const supply = ethers.parseUnits(String(property.total_supply_x ?? 100000), 18);
      await (await token.mint(this.adminAddress, supply)).wait();

      await this.propertyRepo.update(property.id, { token_address: tokenAddr });
      deployedTokens.push({ propertyId: property.id, title: property.title, symbol, tokenAddress: tokenAddr });
      this.logger.log(`✅ ${property.title} Token: ${tokenAddr} (Compliance: ${tokenComplianceAddr})`);
    }

    // 8. Register all users with wallets + issue KYC claim
    const users = await this.userRepo.find();
    const registeredUsers: any[] = [];

    for (const user of users) {
      if (!user.wallet_address || !user.wallet_private_key) continue;
      try {
        const result = await this.issueKycClaim(user, ir, adminIdentityAddr);
        registeredUsers.push({ userId: user.id, username: user.username, ...result });
        this.logger.log(`✅ 用戶 ${user.username} KYC Claim 已發行`);
      } catch (e: any) {
        this.logger.warn(`⚠️ 用戶 ${user.username} KYC 失敗: ${e.message}`);
      }
    }

    return {
      success: true,
      adminWallet: this.adminAddress,
      infrastructure: { identityRegistry: irAddr, compliance: complianceAddr },
      propertyTokens: deployedTokens,
      registeredUsers,
    };
  }

  // ──────────────────────────────────────────
  // KYC: 完整 ERC-3643 Claim 發行流程
  // ──────────────────────────────────────────

  private async issueKycClaim(
    user: { wallet_address: string; wallet_private_key?: string },
    ir: ethers.Contract,
    adminIdentityAddr: string,
  ): Promise<{ walletAddress: string; identityAddress: string }> {
    // 用 admin 作為 identity 管理金鑰（custodial 模式，用戶錢包無 ETH 無法付 gas）
    const userIdentity = await this.deployContract('MyIdentity', this.adminAddress, false);
    const userIdentityAddr = await userIdentity.getAddress();

    // 在 IdentityRegistry 登記：用戶錢包地址 → Identity 合約
    await (await ir.registerIdentity(user.wallet_address, userIdentityAddr, 886)).wait();

    // Admin 簽署 KYC Claim
    const claimData = '0x';
    const dataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'bytes'],
        [userIdentityAddr, 1n, claimData],
      ),
    );
    const signature = await this.adminWallet.signMessage(ethers.getBytes(dataHash));

    // Admin（management key）直接將 KYC Claim 寫入用戶 Identity
    await (await userIdentity.addClaim(1, 1, adminIdentityAddr, signature, claimData, '')).wait();

    return { walletAddress: user.wallet_address, identityAddress: userIdentityAddr };
  }

  async registerUserOnChain(userId: number): Promise<{ walletAddress: string; identityAddress: string }> {
    if (!this.isProviderReady || !(await this.isNodeReachable())) {
      throw new Error('Hardhat 節點未啟動');
    }

    const irAddr = await this.getConfig('ir_address');
    if (!irAddr) throw new Error('尚未部署。請先呼叫 POST /api/blockchain/setup');

    const adminIdentityAddr = await this.getConfig('admin_identity_address');
    if (!adminIdentityAddr) throw new Error('找不到 admin identity，請重新執行 setup');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error(`找不到用戶 ID=${userId}`);
    if (!user.wallet_address) throw new Error(`用戶 ${user.username} 沒有錢包`);
    if (!user.wallet_private_key) throw new Error(`用戶 ${user.username} 沒有私鑰（非平台管理帳戶）`);

    const ir = this.getContract('MyIdentityRegistry', irAddr);

    // 已登記過則直接回傳
    const alreadyRegistered = await ir.contains(user.wallet_address);
    if (alreadyRegistered) {
      return { walletAddress: user.wallet_address, identityAddress: '已登記' };
    }

    const result = await this.issueKycClaim(user, ir, adminIdentityAddr);
    this.logger.log(`✅ 用戶 ${user.username} KYC Claim 已發行`);
    return result;
  }

  // ──────────────────────────────────────────
  // Trading: on-chain buy / sell
  // ──────────────────────────────────────────

  async executeOnChainBuy(tokenAddress: string, toWalletAddress: string, amount: number): Promise<string> {
    const token = this.getContract('MySimpleRWA', tokenAddress);
    const amountWei = ethers.parseUnits(amount.toString(), 18);
    const tx = await token.transfer(toWalletAddress, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async executeOnChainSell(tokenAddress: string, userWalletAddress: string, amount: number): Promise<string> {
    // 用 forcedTransfer（admin agent 權限），不需要用戶錢包有 ETH 付 gas
    const token = this.getContract('MySimpleRWA', tokenAddress);
    const amountWei = ethers.parseUnits(amount.toString(), 18);
    const tx = await token.forcedTransfer(userWalletAddress, this.adminAddress, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ──────────────────────────────────────────
  // Legacy: metadata + transfer speed test
  // ──────────────────────────────────────────

  async getStatus() {
    const nodeOk = await this.isNodeReachable();
    const irAddr = await this.getConfig('ir_address');
    const properties = await this.propertyRepo.find({ select: ['id', 'title', 'token_address'] as any });

    return {
      nodeReachable: nodeOk,
      artifactsCompiled: this.artifactsExist(),
      adminWallet: this.adminWallet?.address ?? null,
      infraDeployed: !!irAddr,
      identityRegistry: irAddr,
      properties: properties.map((p) => ({
        id: p.id,
        title: p.title,
        tokenAddress: p.token_address ?? null,
      })),
    };
  }

  async getContractMetadata() {
    const irAddr = await this.getConfig('ir_address');
    if (!irAddr || !(await this.isNodeReachable())) {
      return { note: '尚未部署。請先呼叫 POST /api/blockchain/setup', standard: 'ERC-3643 (T-REX v4)' };
    }

    const properties = await this.propertyRepo.find({ select: ['id', 'title', 'token_address'] as any });
    const tokens: any[] = [];
    for (const p of properties) {
      if (!p.token_address) continue;
      try {
        const token = this.getContract('MySimpleRWA', p.token_address, this.provider as any);
        tokens.push({
          propertyId: p.id,
          title: p.title,
          name: await token.name(),
          symbol: await token.symbol(),
          totalSupply: ethers.formatUnits(await token.totalSupply(), 18),
          tokenAddress: p.token_address,
        });
      } catch { /* skip */ }
    }
    return { standard: 'ERC-3643 (T-REX v4)', identityRegistry: irAddr, tokens };
  }

  async transferWithSpeedTest(to: string) {
    const properties = await this.propertyRepo.findOne({ where: {}, select: ['id', 'title', 'token_address'] as any });
    if (!properties?.token_address || !(await this.isNodeReachable())) {
      return { error: '尚未部署。請先呼叫 POST /api/blockchain/setup' };
    }
    const start = Date.now();
    const txHash = await this.executeOnChainBuy(properties.token_address, to, 1);
    const duration = Date.now() - start;
    await this.rwaRepo.save(
      this.rwaRepo.create({ txHash, fromAddress: this.adminAddress, toAddress: to, amount: '1', executionTimeMs: duration }),
    );
    return { status: 'Success', duration: `${duration}ms`, txHash, tokenAddress: properties.token_address };
  }
}
