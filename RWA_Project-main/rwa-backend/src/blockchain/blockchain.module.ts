import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { RwaTransaction } from '../transaction.entity';
import { Property } from '../entities/property.entity';
import { User } from '../entities/user.entity';
import { BlockchainConfig } from '../entities/blockchain-config.entity';
import { UserHolding } from '../entities/user-holdings.entity';
import { AppTransaction } from '../entities/app-transaction.entity';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RwaTransaction, Property, User, BlockchainConfig, UserHolding, AppTransaction]),
    SystemModule,
  ],
  controllers: [BlockchainController],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
