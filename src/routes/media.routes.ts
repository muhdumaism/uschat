import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { config } from '../config';
import { authenticate } from '../middleware/auth.middleware';

const pump = promisify(pipeline);

export async function mediaRoutes(fastify: FastifyInstance) {
  fastify.post('/upload', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'Bad Request', message: 'No file uploaded' });
      }

      const ext = path.extname(data.filename) || '.jpg';
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
      const filepath = path.join(config.localStorageDir, filename);

      await pump(data.file, fs.createWriteStream(filepath));

      const fileUrl = `https://uschat.ruptyl.space/uploads/${filename}`;
      return reply.status(201).send({ fileUrl });
    } catch (err: any) {
      request.log.error('Media upload error:', err);
      return reply.status(500).send({ error: 'Upload Failed', message: err.message });
    }
  });
}
