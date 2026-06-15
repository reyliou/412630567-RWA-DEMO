import { Controller, Get, Post, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('blockchain/status')
  getStatus() {
    return this.blockchainService.getStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Post('blockchain/setup')
  setup(@Request() req: any) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.setupBlockchain();
  }

  @UseGuards(JwtAuthGuard)
  @Post('blockchain/register-user/:userId')
  registerUser(@Request() req: any, @Param('userId') userId: string) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.registerUserOnChain(parseInt(userId));
  }

  @Get('metadata')
  getMetadata() {
    return this.blockchainService.getContractMetadata();
  }

  @Get('test-transfer')
  testTransfer(@Query('to') to: string) {
    const target = to || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    return this.blockchainService.transferWithSpeedTest(target);
  }
}
