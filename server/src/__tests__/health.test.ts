import request from 'supertest';
import app from '../app.js';

describe('Health & 404', () => {
  it('GET /api/v1/health returns 200', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/running/i);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.environment).toBeDefined();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns 404 for unknown methods on existing routes', async () => {
    const res = await request(app).delete('/api/v1/health');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
