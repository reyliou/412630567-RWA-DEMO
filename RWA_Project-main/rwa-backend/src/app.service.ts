import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { RwaTransaction } from './transaction.entity';

@Injectable()
export class AppService implements OnModuleInit {
  private provider!: ethers.JsonRpcProvider;
  private wallet!: ethers.Wallet;

  constructor(
    @InjectRepository(RwaTransaction)
    private txRepo: Repository<RwaTransaction>,
  ) {}

  onModuleInit() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
    this.wallet = new ethers.Wallet(process.env.ADMIN_KEY!, this.provider);
  }

  // 1. 展示 API 內涵資料
  async getContractMetadata() {
    const token = new ethers.Contract(process.env.TOKEN_ADDR!, [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function identityRegistry() view returns (address)",
      "function compliance() view returns (address)",
      "function totalSupply() view returns (uint256)"
    ], this.provider);

    return {
      tokenName: await token.name(),
      symbol: await token.symbol(),
      totalSupply: ethers.formatUnits(await token.totalSupply(), 18),
      identityRegistry: await token.identityRegistry(),
      compliance: await token.compliance(),
      standard: "ERC-3643 (T-REX v4)"
    };
  }

  // 2. 轉帳測速 (已補齊 amount 與 fromAddress)
  async transferWithSpeedTest(to: string) {
    const token = new ethers.Contract(process.env.TOKEN_ADDR!, [
      "function transfer(address to, uint256 amount) public returns (bool)"
    ], this.wallet);

    const ir = new ethers.Contract(process.env.IDENTITY_REG_ADDR!, [
      "function registerIdentity(address, address, uint16) external",
      "function isVerified(address) view returns (bool)"
    ], this.wallet);

    // ERC-3643 強制檢查：若未驗證則自動幫他驗證
    const isVerified = await ir.isVerified(to);
    if (!isVerified) {
      console.log(`📡 [KYC] 地址 ${to} 未驗證，正在執行鏈上審核...`);
      // 這裡使用 42 作為區域代碼 (台南測試用)
      const kycTx = await ir.registerIdentity(to, process.env.TOKEN_ADDR!, 42);
      await kycTx.wait();
    }

    const start = Date.now();
    const amountStr = "1"; // DEMO 轉帳數量
    
    // 執行轉帳
    const tx = await token.transfer(to, ethers.parseUnits(amountStr, 18));
    const receipt = await tx.wait();
    
    const end = Date.now();
    const duration = end - start;

    // ✨ 同步到 PostgreSQL (補齊所有欄位)
    const log = this.txRepo.create({
      txHash: receipt.hash,
      fromAddress: receipt.from,      // ✨ 新增：紀錄誰轉的
      toAddress: to,
      amount: amountStr,              // ✨ 新增：紀錄轉了多少 (1 顆)
      executionTimeMs: duration
    });
    
    await this.txRepo.save(log);

    return {
      status: "Success",
      duration: `${duration}ms`,
      txHash: receipt.hash,
      fromAddress: receipt.from,      // 回傳給前端看
      amount: amountStr,              // 回傳給前端看
      database: "Synced to PostgreSQL (with Local Time Offset)"
    };
  }
}