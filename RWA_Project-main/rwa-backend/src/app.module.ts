import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { Property } from './entities/property.entity';
import { AppTransaction } from './entities/app-transaction.entity';
import { UserHolding } from './entities/user-holdings.entity';
import { UserNotification } from './entities/notification.entity';
import { SystemAlert } from './entities/system-alert.entity';
import { CrawlerMetrics } from './entities/crawler-metrics.entity';
import { RentPayoutBatch } from './entities/rent-payout-batch.entity';
import { RentPayoutDetail } from './entities/rent-payout-detail.entity';
import { BankTrustAccount } from './entities/bank-trust.entity';
import { ValuationLog } from './entities/valuation-log.entity';
import { RwaTransaction } from './transaction.entity';
import { BlockchainConfig } from './entities/blockchain-config.entity';

import { AuthModule } from './auth/auth.module';
import { SystemModule } from './system/system.module';
import { PropertiesModule } from './properties/properties.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      // ⚠️ url 只在明確設定 DATABASE_URL 時才使用；絕不寫死正式環境的連線字串當 fallback，
      // 否則本機開發預設值（DB_HOST=localhost 等）會被 url 蓋過，變成連到正式資料庫。
      url: process.env.DATABASE_URL || undefined,
      host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || 'localhost'),
      port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5433'),
      username: process.env.DATABASE_URL ? undefined : (process.env.DB_USERNAME || 'user'),
      password: process.env.DATABASE_URL ? undefined : (process.env.DB_PASSWORD || 'password'),
      database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || 'rwa_db'),
      entities: [
        Role,
        User,
        Property,
        AppTransaction,
        UserHolding,
        UserNotification,
        SystemAlert,
        CrawlerMetrics,
        RentPayoutBatch,
        RentPayoutDetail,
        BankTrustAccount,
        ValuationLog,
        RwaTransaction,
        BlockchainConfig,
      ],
      synchronize: false,
      ssl: (process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost')) ? { rejectUnauthorized: false } : false,
    }),
    AuthModule,
    SystemModule,
    PropertiesModule,
    TransactionsModule,
    UsersModule,
    PortfolioModule,
    NotificationsModule,
    BlockchainModule,
    SeedModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
