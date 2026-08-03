import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { UserNotification } from '../entities/notification.entity';
import { AppTransaction } from '../entities/app-transaction.entity';
import { Property } from '../entities/property.entity';
import { User } from '../entities/user.entity';
import { SystemModule } from '../system/system.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserNotification, AppTransaction, Property, User]),
    SystemModule,
    BlockchainModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
