import {
  Controller, Get, Post, Body, UseGuards, Request, ForbiddenException, HttpCode, HttpStatus
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppTransaction } from '../entities/app-transaction.entity';

@Controller('api')
export class SystemController {
  constructor(
    private systemService: SystemService,
    @InjectRepository(AppTransaction)
    private txRepo: Repository<AppTransaction>,
  ) {}

  @Get('health')
  health() {
    return { status: 'OK', message: 'RWA Server is healthy' };
  }

  @Get('system/performance')
  getPerformance() {
    return this.systemService.getPerformance();
  }

  @Get('system/crawler-status')
  getCrawlerStatus() {
    return this.systemService.getCrawlerStatus();
  }

  @Post('system/crawler-report')
  @HttpCode(HttpStatus.OK)
  async crawlerReport(@Body() body: { failures: number; integrity: number; status: string }) {
    await this.systemService.updateCrawlerReport(body.failures, body.integrity, body.status);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('system/state')
  async getState() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const activeTransactions = await this.txRepo
      .createQueryBuilder('t')
      .where('t.created_at > :oneHourAgo', { oneHourAgo })
      .getCount();

    return { ...this.systemService.getState(), activeTransactions };
  }

  @UseGuards(JwtAuthGuard)
  @Post('system/state')
  @HttpCode(HttpStatus.OK)
  setState(@Request() req: any, @Body() body: any) {
    const { role } = req.user;
    if (role !== 'TECHNICAL' && role !== 'BUSINESS') throw new ForbiddenException('權限不足');
    return this.systemService.setState(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('chat')
  getChat(@Request() req: any) {
    const { role } = req.user;
    if (role !== 'TECHNICAL' && role !== 'BUSINESS') throw new ForbiddenException('權限不足');
    return this.systemService.getChat();
  }

  @UseGuards(JwtAuthGuard)
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  sendChat(@Request() req: any, @Body() body: { sender: string; content: string }) {
    const { role } = req.user;
    if (role !== 'TECHNICAL' && role !== 'BUSINESS') throw new ForbiddenException('權限不足');
    const msg = this.systemService.addChat(body.sender, body.content);
    return { success: true, message: msg };
  }

  @UseGuards(JwtAuthGuard)
  @Get('system-alerts')
  async getAlerts(@Request() req: any) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.systemService.getAlerts();
  }
}
