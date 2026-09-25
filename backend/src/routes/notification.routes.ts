import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { NotificationService } from '../services/notification.service';
import { prisma } from '../prisma/client';

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.string().default('android'),
  deviceId: z.string().optional(),
});

const unregisterTokenSchema = z.object({
  token: z.string().min(1),
});

export async function notificationRoutes(fastify: FastifyInstance) {
  // Register FCM token
  fastify.post('/register-token', { preHandler: [authenticate] }, async (request, reply) => {
    const body = registerTokenSchema.parse(request.body);
    await NotificationService.registerToken(
      request.user.id,
      body.token,
      body.platform,
      body.deviceId,
    );
    return reply.send({ success: true });
  });

  // Unregister FCM token (on logout)
  fastify.post('/unregister-token', { preHandler: [authenticate] }, async (request, reply) => {
    const body = unregisterTokenSchema.parse(request.body);
    await NotificationService.unregisterToken(body.token);
    return reply.send({ success: true });
  });

  // Clean up invalid tokens for current user
  fastify.post('/clean-tokens', { preHandler: [authenticate] }, async (request, reply) => {
    await NotificationService.cleanInvalidTokens(request.user.id);
    return reply.send({ success: true });
  });

  // Get current unread notification badge count
  fastify.get('/badge-count', { preHandler: [authenticate] }, async (request, reply) => {
    const userChats = await prisma.chatMember.findMany({
      where: { userId: request.user.id },
      select: { chatId: true },
    });

    const chatIds = userChats.map((c) => c.chatId);

    const unreadCount = await prisma.message.count({
      where: {
        chatId: { in: chatIds },
        senderId: { not: request.user.id },
      },
    });

    return reply.send({ unreadBadgeCount: unreadCount });
  });
}
