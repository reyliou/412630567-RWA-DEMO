import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '../entities/property.entity';
import { ValuationLog } from '../entities/valuation-log.entity';
import { RentPayoutBatch } from '../entities/rent-payout-batch.entity';
import { RentPayoutDetail } from '../entities/rent-payout-detail.entity';
import { UserHolding } from '../entities/user-holdings.entity';
import { User } from '../entities/user.entity';

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

      const detail = await this.detailRepo.save({
        batch_id: batch.id,
        user_id: holding.user_id,
        holding_percentage: holdingPercentage,
        payout_amount: payoutAmount,
        status: 'PAID'
      });

      // Update user profit
      await this.userRepo.increment({ id: holding.user_id }, 'total_profit_loss', payoutAmount);
      processedDetails.push(detail);
    }

    // 4. Complete the batch
    await this.batchRepo.update(batch.id, { status: 'COMPLETED' });

    return {
      success: true,
      batch_id: batch.id,
      total_distributed: totalRent,
      recipients_count: processedDetails.length
    };
  }
}
