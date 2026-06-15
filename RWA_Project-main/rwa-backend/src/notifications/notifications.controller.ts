import { Controller, Get, Patch, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('notifications/:userId')
  getNotifications(@Request() req: any, @Param('userId') userId: string) {
    if (req.user.id !== parseInt(userId)) throw new ForbiddenException('權限不足');
    return this.notificationsService.findByUser(parseInt(userId));
  }

  @Patch('notifications/:userId/read')
  markRead(@Request() req: any, @Param('userId') userId: string) {
    if (req.user.id !== parseInt(userId)) throw new ForbiddenException('權限不足');
    return this.notificationsService.markRead(parseInt(userId));
  }
}
