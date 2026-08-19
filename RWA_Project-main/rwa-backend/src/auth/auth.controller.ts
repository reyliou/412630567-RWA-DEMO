import { Controller, Post, Body, HttpCode, HttpStatus, UseInterceptors, UploadedFiles, UseGuards, Request } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Post('register')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'kyc_document', maxCount: 1 },
    { name: 'kyc_document_back', maxCount: 1 }
  ]))
  register(
    @Body() body: any,
    @UploadedFiles() files: { kyc_document?: Express.Multer.File[], kyc_document_back?: Express.Multer.File[] }
  ) {
    return this.authService.register(
      body.username, 
      body.email, 
      body.phone_number, 
      body.password, 
      files?.kyc_document?.[0], 
      files?.kyc_document_back?.[0]
    );
  }

  @Post('auth/change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Request() req: any, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.id, body.oldPassword, body.newPassword);
  }
}
