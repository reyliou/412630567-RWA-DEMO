import { Controller, Get, Patch, Post, Param, Body, UseGuards, Request, ForbiddenException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('users/profile/me')
  getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

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

  @Patch('users/:id/kyc/reject')
  rejectKyc(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    if (req.user.role !== 'BUSINESS') throw new ForbiddenException('需要管理員權限');
    return this.usersService.rejectKyc(parseInt(id), req.user.id, body.reason || '');
  }

  @Post('kyc/resubmit')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'kyc_document', maxCount: 1 },
    { name: 'kyc_document_back', maxCount: 1 }
  ], {
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB 單檔上限
  }))
  resubmitKyc(
    @Request() req: any,
    @UploadedFiles() files: { kyc_document?: Express.Multer.File[], kyc_document_back?: Express.Multer.File[] },
  ) {
    return this.usersService.resubmitKyc(
      req.user.id,
      files?.kyc_document?.[0],
      files?.kyc_document_back?.[0],
    );
  }

  @Post('kyc/:id/decrypt')
  decryptKyc(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { adminKey: string }
  ) {
    if (req.user.role !== 'BUSINESS') throw new ForbiddenException('需要管理員權限');
    return this.usersService.decryptKycImages(parseInt(id), body.adminKey, req.user.id);
  }
}
