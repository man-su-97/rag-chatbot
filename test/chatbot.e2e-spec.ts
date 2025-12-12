import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('ChatbotController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/chatbot/message (POST)', () => {
    return request(app.getHttpServer())
      .post('/chatbot/message')
      .send({
        sessionId: 'test-session-id',
        message: 'Hello, world!',
        providerConfig: {
          provider: 'openai',
          apiKey: 'test-api-key',
          model: 'test-model',
        },
      })
      .expect(201);
  });

  it('/chatbot/message (POST) with invalid body', () => {
    return request(app.getHttpServer())
      .post('/chatbot/message')
      .send({
        sessionId: 'test-session-id',
      })
      .expect(400);
  });
});
