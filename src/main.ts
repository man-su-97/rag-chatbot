import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // --- Swagger (OpenAPI) Setup ---
  const config = new DocumentBuilder()
    .setTitle('AI Chatbot API')
    .setDescription('API documentation for the AI Chatbot backend')
    .setVersion('1.0')
    .addTag('chatbot')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  // --- End Swagger Setup ---

  await app.listen(3005);
}
bootstrap();
