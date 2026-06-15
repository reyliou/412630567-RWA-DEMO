import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  // 顯示合約內涵資料
  @Get('metadata')
  async getMetadata() {
    return await this.appService.getContractMetadata();
  }

  // 執行轉帳測速
  @Get('test-transfer')
  async test(@Query('to') to: string) {
    // 預設轉給 Hardhat 第 2 把錢包
    const target = to || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    return await this.appService.transferWithSpeedTest(target);
  }
}