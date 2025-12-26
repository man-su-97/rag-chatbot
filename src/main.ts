import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3005'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('AI Chatbot API')
    .setDescription(
      `
Multimodel AI Chatbot Backend (LangGraph powered)

**Testing Guide**
1. Create a session → POST /chatbot/session/new
2. (Optional) Configure provider → POST /chatbot/session/configure
3. Send messages → POST /chatbot/message
4. Use streaming → GET /chatbot/chat-stream (NDJSON)


    `,
    )
    .setVersion('1.0.0')
    .addTag('chatbot', 'Chat, streaming & session APIs')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(3005);

  console.log('Server running on http://localhost:3005');
  console.log('Swagger UI available at http://localhost:3005/api');
}

bootstrap();
