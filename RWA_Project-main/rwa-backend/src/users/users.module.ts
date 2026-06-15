import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { SystemAlert } from '../entities/system-alert.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, SystemAlert]),
    BlockchainModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
