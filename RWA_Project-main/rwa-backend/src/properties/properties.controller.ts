import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
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

  @Get('properties/:id/kline')
  getKLineData(@Param('id') id: string) {
    return this.propertiesService.getKLineData(parseInt(id));
  }

  @Post('properties/:id/payout')
  async distributeRent(@Param('id') id: string, @Body() body: { amount: number }, @Req() req: any) {
    if (req.user?.role !== 'BUSINESS' && req.user?.role !== 'TECHNICAL') {
      throw new ForbiddenException('Only BUSINESS accounts can execute payouts.');
    }
    if (body.amount <= 0 || body.amount > 1000000) {
      throw new ForbiddenException('Invalid payout amount.');
    }
    return this.propertiesService.executePayout(parseInt(id), body.amount);
  }

  @Patch('properties/:id/payout-cycle')
  async updatePayoutCycle(
    @Param('id') id: string,
    @Body() body: { payout_cycle_days: number },
    @Req() req: any
  ) {
    if (req.user?.role !== 'BUSINESS' && req.user?.role !== 'TECHNICAL') {
      throw new ForbiddenException('Only BUSINESS accounts can update payout cycle.');
    }
    const days = parseInt(String(body.payout_cycle_days));
    if (isNaN(days) || days < 1 || days > 365) {
      throw new ForbiddenException('發放週期必須在 1 至 365 天之間');
    }
    return this.propertiesService.updatePayoutCycle(parseInt(id), days);
  }
}
