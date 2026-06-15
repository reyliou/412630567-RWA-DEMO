import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { User } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { BankTrustAccount } from '../entities/bank-trust.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Property, BankTrustAccount])],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
