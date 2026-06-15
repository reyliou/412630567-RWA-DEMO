import { Controller, Get, Patch, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('users')
  getAll(@Request() req: any) {
    if (req.user.role !== 'BUSINESS') throw new ForbiddenException('需要管理員權限');
    return this.usersService.findAll();
  }

  @Patch('users/:id/whitelist')
  updateWhitelist(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { is_whitelisted: boolean; reason?: string },
  ) {
    if (req.user.role !== 'BUSINESS') throw new ForbiddenException('需要管理員權限');
    return this.usersService.updateWhitelist(parseInt(id), body.is_whitelisted, req.user.id, body.reason || '');
  }

  @Patch('users/:id/kyc')
  approveKyc(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'BUSINESS') throw new ForbiddenException('需要管理員權限');
    return this.usersService.approveKyc(parseInt(id), req.user.id);
  }
}
