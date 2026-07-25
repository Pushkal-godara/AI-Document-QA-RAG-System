import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // exposedHeaders is required - browsers hide non-safelisted response
  // headers (like our X-Conversation-Id) from client JS on cross-origin
  // requests unless the server explicitly opts them in here.
  app.enableCors({ origin: true, credentials: true, exposedHeaders: ['X-Conversation-Id'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}
bootstrap();
