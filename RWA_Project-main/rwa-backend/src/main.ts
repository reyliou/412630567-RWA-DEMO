import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const DEFAULT_JWT_SECRET = 'rwa-bank-super-secret-key-2026';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    Logger.warn(
      '⚠️ JWT_SECRET 未設定或仍是原始碼中的預設值 — 此為公開 repo 中的已知字串，任何人都能偽造具技術員權限的 JWT！請在雲端環境變數中設定一組獨立的隨機字串（例如 openssl rand -hex 32），並確保與其他需要互通的服務使用相同的值。',
      'Bootstrap',
    );
  }

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 RWA NestJS Server running on port ${port}`);
}
bootstrap();
