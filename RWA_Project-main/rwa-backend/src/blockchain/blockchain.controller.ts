import { Controller, Get, Post, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// 守衛提到類別層級：status 與 metadata 先前完全公開，會對外洩漏 admin 錢包位址、
// IdentityRegistry 與所有代幣合約位址。與 properties/users/portfolio 的寫法一致。
@Controller('api')
@UseGuards(JwtAuthGuard)
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('blockchain/status')
  getStatus() {
    return this.blockchainService.getStatus();
  }

  @Post('blockchain/setup')
  setup(@Request() req: any) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.setupBlockchain();
  }

  @Post('blockchain/register-user/:userId')
  registerUser(@Request() req: any, @Param('userId') userId: string) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.registerUserOnChain(parseInt(userId));
  }

  @Post('blockchain/pause-toggle')
  setPause(@Request() req: any, @Body() body: { isPaused: boolean }) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.setPauseState(!!body.isPaused);
  }

  @Get('blockchain/reconcile')
  reconcile(@Request() req: any) {
    if (req.user.role !== 'TECHNICAL') throw new ForbiddenException('需要技術員權限');
    return this.blockchainService.reconcile();
  }

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
