import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { ZodError } from 'zod';
import { config } from './config';
import { prisma } from './prisma/client';
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { keysRoutes } from './routes/keys.routes';
import { chatRoutes } from './routes/chat.routes';
import { messageRoutes } from './routes/message.routes';
import { mediaRoutes } from './routes/media.routes';
import { callRoutes } from './routes/call.routes';
import { adminRoutes } from './routes/admin.routes';
import { notificationRoutes } from './routes/notification.routes';
import { registerWebSocketRoutes } from './websocket/ws.handler';

export function buildApp() {
  const app = fastify({ logger: true });

  if (!fs.existsSync(config.localStorageDir)) {
    fs.mkdirSync(config.localStorageDir, { recursive: true });
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.issues,
      });
    }
    reply.status(error.statusCode || 500).send({
      error: error.name || 'Internal Server Error',
      message: error.message,
    });
  });

  app.register(cors, { origin: config.corsOrigins });
  app.register(fastifyJwt, { secret: config.jwtSecret });
  app.register(fastifyWebsocket);
  app.register(fastifyMultipart, { limits: { fileSize: 100 * 1024 * 1024 } });
  app.register(fastifyRateLimit, { max: 200, timeWindow: '1 minute' });

  app.register(fastifyStatic, {
    root: config.localStorageDir,
    prefix: '/uploads/',
  });

  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(userRoutes, { prefix: '/api/v1/users' });
  app.register(keysRoutes, { prefix: '/api/v1/keys' });
  app.register(chatRoutes, { prefix: '/api/v1/chats' });
  app.register(messageRoutes, { prefix: '/api/v1/messages' });
  app.register(mediaRoutes, { prefix: '/api/v1/media' });
  app.register(callRoutes, { prefix: '/api/v1/calls' });
  app.register(adminRoutes, { prefix: '/api/v1/admin' });
  app.register(notificationRoutes, { prefix: '/api/v1/notifications' });

  app.after(async () => {
    registerWebSocketRoutes(app);

    // Seed @uschat_bot system user
    try {
      const existingBot = await prisma.user.findUnique({ where: { username: 'uschat_bot' } });
      if (!existingBot) {
        const hash = await bcrypt.hash('uschat_bot_password_123', 10);
        await prisma.user.create({
          data: {
            email: 'bot@uschat.app',
            username: 'uschat_bot',
            displayName: 'USCHAT Encrypted Bot',
            passwordHash: hash,
            bio: '🤖 Automated Signal E2EE Bot for local testing.',
            role: 'USER',
          },
        });
        console.log('🤖 USCHAT System Bot User (@uschat_bot) created.');
      }
    } catch (err) {
      console.error('Bot Seeding Error:', err);
    }
  });

  app.get('/health', async () => {
    return { status: 'healthy', timestamp: new Date(), version: '1.0.0' };
  });

  return app;
}
