import { Controller, Get, Post, Param, Query, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Post('blockchain/pause-toggle')
  setPause(@Request() req: any, @Body() body: { isPaused: boolean }) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.setPauseState(!!body.isPaused);
  }

  @UseGuards(JwtAuthGuard)
  @Get('blockchain/reconcile')
  reconcile(@Request() req: any) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.reconcile();
  }

  @UseGuards(JwtAuthGuard)
  @Post('blockchain/reconcile/repair')
  reconcileAndRepair(@Request() req: any) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.reconcile(true);
  }

  @Get('metadata')
  getMetadata() {
    return this.blockchainService.getContractMetadata();
  }
}
