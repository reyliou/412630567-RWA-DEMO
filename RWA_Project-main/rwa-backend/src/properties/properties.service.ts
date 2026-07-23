import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '../entities/property.entity';
import { ValuationLog } from '../entities/valuation-log.entity';
import { RentPayoutBatch } from '../entities/rent-payout-batch.entity';
import { RentPayoutDetail } from '../entities/rent-payout-detail.entity';
import { UserHolding } from '../entities/user-holdings.entity';
import { User } from '../entities/user.entity';
import { BankTrustAccount } from '../entities/bank-trust.entity';
import { BankTrustTransaction } from '../entities/bank-trust-transaction.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(ValuationLog)
    private valuationRepo: Repository<ValuationLog>,
    @InjectRepository(RentPayoutBatch)
    private batchRepo: Repository<RentPayoutBatch>,
    @InjectRepository(RentPayoutDetail)
    private detailRepo: Repository<RentPayoutDetail>,
    @InjectRepository(UserHolding)
    private holdingRepo: Repository<UserHolding>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(BankTrustAccount)
    private trustAccountRepo: Repository<BankTrustAccount>,
    @InjectRepository(BankTrustTransaction)
    private trustTxRepo: Repository<BankTrustTransaction>,
    private blockchainService: BlockchainService,
  ) {}

  findAll() {
    return this.propertyRepo.find({ order: { id: 'DESC' } });
  }

  async getValuationLogs(propertyId: number) {
    return this.valuationRepo.find({
      where: { property_id: propertyId },
      order: { recorded_at: 'ASC' },
    });
  }

  async executePayout(propertyId: number, totalRent: number) {
    // 1. Create a payout batch
    const batch = await this.batchRepo.save({
      property_id: propertyId,
      payout_period: new Date(),
      total_rent_collected: totalRent,
      status: 'PROCESSING'
    });

    // 2. Find all holders for this property
    const holdings = await this.holdingRepo.find({ where: { property_id: propertyId } });
    const property = await this.propertyRepo.findOne({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');

    let totalTokens = Number(property.total_supply_x) || 100000;
    
    // 3. Distribute rent based on holdings
    let processedDetails: any[] = [];
    for (const holding of holdings) {
      if (Number(holding.balance) <= 0) continue;

      const holdingPercentage = (Number(holding.balance) / totalTokens) * 100;
      const payoutAmount = (holdingPercentage / 100) * totalRent;

      // 鏈上發放：admin wallet 送出對應金額給持有人錢包，失敗不影響資料庫面的撥款紀錄
      let txHash: string | undefined;
      let status = 'PAID';
      const holder = await this.userRepo.findOne({ where: { id: holding.user_id } });
      if (holder?.wallet_address) {
        try {
          txHash = await this.blockchainService.payoutRentOnChain(holder.wallet_address, payoutAmount);
        } catch {
          status = 'FAILED';
        }
      }

      const detail = await this.detailRepo.save({
        batch_id: batch.id,
        user_id: holding.user_id,
        holding_percentage: holdingPercentage,
        payout_amount: payoutAmount,
        status,
        tx_hash: txHash,
      });

      // Update user profit
      await this.userRepo.increment({ id: holding.user_id }, 'total_profit_loss', payoutAmount);
      processedDetails.push(detail);
    }

    // 4. Complete the batch
    await this.batchRepo.update(batch.id, { status: 'COMPLETED' });

    // 5. Update Bank Trust Account and Record Transaction
    const trustAccount = await this.trustAccountRepo.findOne({ where: { property_id: propertyId } });
    if (trustAccount) {
      // Deduct pending rent and cash balance
      trustAccount.pending_rent_amount = Math.max(0, Number(trustAccount.pending_rent_amount) - totalRent);
      trustAccount.current_cash_balance = Math.max(0, Number(trustAccount.current_cash_balance) - totalRent);
      await this.trustAccountRepo.save(trustAccount);

      // Record the transaction
      await this.trustTxRepo.save({
        trust_account_id: trustAccount.id,
        tx_type: 'PAYOUT_DEDUCTION',
        amount: totalRent,
        reference_note: `Rent payout for batch #${batch.id}`
      });
    }

    return {
      success: true,
      batch_id: batch.id,
      total_distributed: totalRent,
      recipients_count: processedDetails.length
    };
  }
}
