import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Property } from '../entities/property.entity';
import { ValuationLog } from '../entities/valuation-log.entity';
import { RentPayoutBatch } from '../entities/rent-payout-batch.entity';
import { RentPayoutDetail } from '../entities/rent-payout-detail.entity';
import { UserHolding } from '../entities/user-holdings.entity';
import { User } from '../entities/user.entity';
import { BankTrustAccount } from '../entities/bank-trust.entity';
import { BankTrustTransaction } from '../entities/bank-trust-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property, ValuationLog, RentPayoutBatch, RentPayoutDetail, UserHolding, User, BankTrustAccount, BankTrustTransaction])],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
