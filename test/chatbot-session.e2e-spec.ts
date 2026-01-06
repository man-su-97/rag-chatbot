import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { App } from 'supertest/types';

describe('ChatbotController (e2e) - Session Management', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/chatbot/session (POST)', () => {
    it('should create a new session and return a session_id', async () => {
      const response = await request(app.getHttpServer())
        .post('/chatbot/session')
        .expect(201);

      expect(response.body).toHaveProperty('session_id');
      expect(typeof response.body.session_id).toBe('string');
    });
  });

  describe('/chatbot/message (POST)', () => {
    it('should send a message and receive a response', async () => {
      const sessionResponse = await request(app.getHttpServer())
        .post('/chatbot/session')
        .expect(201);
      const sessionId = sessionResponse.body.session_id;

      const messageResponse = await request(app.getHttpServer())
        .post('/chatbot/message')
        .send({ session_id: sessionId, message: 'hello' })
        .expect(200);

      expect(messageResponse.body).toHaveProperty('message');
    });
  });

  describe('/chatbot/history (GET)', () => {
    it('should retrieve the session history', async () => {
      const sessionResponse = await request(app.getHttpServer())
        .post('/chatbot/session')
        .expect(201);
      const sessionId = sessionResponse.body.session_id;

      await request(app.getHttpServer())
        .post('/chatbot/message')
        .send({ session_id: sessionId, message: 'hello' });

      const historyResponse = await request(app.getHttpServer())
        .get(`/chatbot/history?session_id=${sessionId}`)
        .expect(200);

      expect(Array.isArray(historyResponse.body)).toBe(true);
      expect(historyResponse.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('/chatbot/stream (POST)', () => {
    it('should send a message and receive a streamed response', async () => {
      const sessionResponse = await request(app.getHttpServer())
        .post('/chatbot/session')
        .expect(201);
      const sessionId = sessionResponse.body.session_id;

      const response = await request(app.getHttpServer())
        .post('/chatbot/stream')
        .send({ session_id: sessionId, message: 'hello' })
        .expect(200);

      expect(response.text.length).toBeGreaterThan(0);
    });
  });
});
