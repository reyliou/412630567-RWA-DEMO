import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '../entities/property.entity';
import { ValuationLog } from '../entities/valuation-log.entity';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(ValuationLog)
    private valuationRepo: Repository<ValuationLog>,
  ) {}

  findAll() {
    return this.propertyRepo.find({ order: { id: 'DESC' } });
  }

  async getValuationLogs(propertyId: number) {
    return this.valuationRepo.find({
      where: { property_id: propertyId },
      order: { recorded_at: 'ASC' },
    });
  }
}
