import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotification } from '../entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(UserNotification)
    private notifRepo: Repository<UserNotification>,
  ) {}

  findByUser(userId: number) {
    return this.notifRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 20,
    });
  }

  async markRead(userId: number) {
    await this.notifRepo.update({ user_id: userId }, { is_read: true });
    return { success: true };
  }
}
