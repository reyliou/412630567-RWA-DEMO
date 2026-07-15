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

@Module({
  imports: [TypeOrmModule.forFeature([Property, ValuationLog, RentPayoutBatch, RentPayoutDetail, UserHolding, User])],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
