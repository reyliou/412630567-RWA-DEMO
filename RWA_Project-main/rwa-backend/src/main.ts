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
      // 允許所有來源 (Vercel 預覽網址、正式網址、localhost 與伺服器請求)
      callback(null, true);
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
