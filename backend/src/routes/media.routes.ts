import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { config } from '../config';
import { authenticate } from '../middleware/auth.middleware';
import { MediaService } from '../services/media.service';

const pump = promisify(pipeline);

export async function mediaRoutes(fastify: FastifyInstance) {
  fastify.post('/upload', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'Bad Request', message: 'No file uploaded' });
      }

      const mime = data.mimetype.toLowerCase();
      let limit = config.uploadLimits.document;
      if (mime.startsWith('image/')) {
        limit = config.uploadLimits.image;
      } else if (mime.startsWith('video/')) {
        limit = config.uploadLimits.video;
      } else if (mime.startsWith('audio/')) {
        limit = config.uploadLimits.voice;
      }

      const ext = path.extname(data.filename) || '.jpg';
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
      const filepath = path.join(config.localStorageDir, filename);

      const fileStream = fs.createWriteStream(filepath);
      await pump(data.file, fileStream);

      const stats = fs.statSync(filepath);
      if (stats.size > limit) {
        fs.unlinkSync(filepath); // delete the oversized file
        return reply.status(400).send({
          error: 'Bad Request',
          message: `File size exceeds the limit of ${limit / (1024 * 1024)} MB for this media type.`
        });
      }

      // Process, compress, generate thumbnails and upload to destination storage provider
      const mediaResult = await MediaService.processAndStoreMedia(filepath, data.filename, mime);
      return reply.status(201).send(mediaResult);
    } catch (err: any) {
      request.log.error('Media upload error:', err);
      return reply.status(500).send({ error: 'Upload Failed', message: err.message });
    }
  });
}
