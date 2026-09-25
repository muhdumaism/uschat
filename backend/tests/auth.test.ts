import { buildApp } from '../src/app';

describe('USCHAT Backend API - System & Auth Integration', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  test('GET /health should return 200 and healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('healthy');
    expect(body.version).toBe('1.0.0');
  });

  test('POST /api/v1/auth/register validation failure with invalid email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'invalid-email-format',
        username: 'testuser',
        password: 'password123',
        displayName: 'Test User',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
