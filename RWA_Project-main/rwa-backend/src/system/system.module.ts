import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { SystemAlert } from '../entities/system-alert.entity';
import { CrawlerMetrics } from '../entities/crawler-metrics.entity';
import { AppTransaction } from '../entities/app-transaction.entity';
import { ChatLog } from '../entities/chat-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemAlert, CrawlerMetrics, AppTransaction, ChatLog])],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
