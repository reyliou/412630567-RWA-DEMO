import { Controller, Get, Post, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
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
}
