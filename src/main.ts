import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable validation pipes for DTOs
  app.useGlobalPipes(new ValidationPipe());

  // Enable CORS for all origins (you can restrict this in production)
  app.enableCors({
    origin: '*',
    credentials: true,
  });
  // Serve static files from uploads directory with /uploads prefix
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  // Listen on all network interfaces (0.0.0.0) to allow IP access
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
