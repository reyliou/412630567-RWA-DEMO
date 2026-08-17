import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SystemService } from '../system/system.service';

@Injectable()
export class ActivityMiddleware implements NestMiddleware {
  constructor(private readonly systemService: SystemService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // 任何打進來的 API 請求都會被視為活躍，重置閒置計時器
    this.systemService.lastActiveTime = Date.now();
    next();
  }
}
