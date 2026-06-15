import { Controller, Get, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortfolioService } from './portfolio.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private portfolioService: PortfolioService) {}

  @Get('portfolio/:userId')
  getPortfolio(@Request() req: any, @Param('userId') userId: string) {
    const uid = parseInt(userId);
    if (req.user.id !== uid && req.user.role !== 'TECHNICAL' && req.user.role !== 'BUSINESS') {
      throw new ForbiddenException('權限不足');
    }
    return this.portfolioService.getPortfolio(uid);
  }

  @Get('transactions/:userId')
  async getTransactions(@Request() req: any, @Param('userId') userId: string) {
    const uid = parseInt(userId);
    if (req.user.id !== uid && req.user.role !== 'TECHNICAL' && req.user.role !== 'BUSINESS') {
      throw new ForbiddenException('權限不足');
    }
    return this.portfolioService.getTransactions(uid);
  }

  @Get('oversight')
  getOversight(@Request() req: any) {
    if (req.user.role !== 'BUSINESS') throw new ForbiddenException('需要管理員權限');
    return this.portfolioService.getOversight();
  }
}
