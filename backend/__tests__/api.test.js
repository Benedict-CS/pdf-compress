import request from 'supertest';
import app from '../server.js';
import fs from 'fs';
import path from 'path';

describe('API Endpoints', () => {
  it('GET /api/ should return online status', async () => {
    const res = await request(app).get('/api/');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('PDF Compressor API is online');
  });

  it('POST /api/compress should reject missing file', async () => {
    const res = await request(app)
      .post('/api/compress')
      .field('quality', '0.9')
      .field('scale', '1.0');
    expect(res.statusCode).toEqual(400);
    expect(res.text).toContain('No files');
  });

  it('GET /api/download/:jobId should return 404 for invalid ID', async () => {
    const res = await request(app).get('/api/download/invalid123');
    expect(res.statusCode).toEqual(404);
  });

  it('POST /api/cancel/:jobId should return 404 for non-existent job', async () => {
    const res = await request(app).post('/api/cancel/invalid123');
    expect(res.statusCode).toEqual(404);
  });
});