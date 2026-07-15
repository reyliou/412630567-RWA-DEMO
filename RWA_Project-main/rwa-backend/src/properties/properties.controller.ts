import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PropertiesService } from './properties.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Get('properties')
  getAll() {
    return this.propertiesService.findAll();
  }

  @Get('properties/:id/valuation-logs')
  getValuationLogs(@Param('id') id: string) {
    return this.propertiesService.getValuationLogs(parseInt(id));
  }

  @Post('properties/:id/payout')
  async distributeRent(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.propertiesService.executePayout(parseInt(id), body.amount);
  }
}
