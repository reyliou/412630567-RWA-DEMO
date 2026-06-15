import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { CrawlerMetrics } from '../entities/crawler-metrics.entity';
import { BankTrustAccount } from '../entities/bank-trust.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User, Property, CrawlerMetrics, BankTrustAccount])],
  providers: [SeedService],
})
export class SeedModule {}
