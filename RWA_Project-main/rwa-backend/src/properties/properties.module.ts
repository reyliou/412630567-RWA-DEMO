import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Property } from '../entities/property.entity';
import { ValuationLog } from '../entities/valuation-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property, ValuationLog])],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
