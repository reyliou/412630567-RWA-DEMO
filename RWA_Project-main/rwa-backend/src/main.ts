import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const DEFAULT_JWT_SECRET = undefined;

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    Logger.error('FATAL: JWT_SECRET environment variable is missing.');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      // 伺服器對伺服器請求 / Postman 沒有 origin，予以放行
      if (!origin) return callback(null, true);
      
      // 白名單：Vercel 預覽與正式網址、設定的 FRONTEND_URL、localhost 開發環境
      let isAllowed = false;
      try {
        const hostname = new URL(origin).hostname;
        isAllowed = 
          /\.vercel\.app$/.test(hostname) ||
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          origin === process.env.FRONTEND_URL?.replace(/\/$/, '') ||
          origin === 'http://localhost:5173' ||
          origin === 'http://localhost:3000' ||
          origin === 'http://localhost:5174';
      } catch (e) {
        isAllowed = false;
      }

      callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 RWA NestJS Server running on port ${port} (0.0.0.0)`);
}
bootstrap();
