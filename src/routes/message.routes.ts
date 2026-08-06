import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { WebSocketManager } from '../websocket/ws.handler';
import { NotificationService } from '../services/notification.service';

const sendMessageSchema = z.object({
  chatId: z.string(),
  encryptedContent: z.string(),
  nonce: z.string().optional(),
  messageType: z.string().default('TEXT'),
  ephemeralDuration: z.number().int().min(0).default(0),
  viewOnce: z.boolean().default(false),
  replyToId: z.string().optional(),
  attachments: z.array(
    z.object({
      fileUrl: z.string(),
      fileType: z.string(),
      fileSizeBytes: z.number(),
      encryptedKey: z.string(),
      initializationVector: z.string(),
    })
  ).optional(),
});

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.get('/:chatId', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const { limit = '50', before } = request.query as { limit?: string; before?: string };

    const take = parseInt(limit, 10);

    const where: any = { chatId };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.message.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        attachments: true,
        replyTo: {
          select: {
            id: true,
            senderId: true,
            encryptedContent: true,
            messageType: true,
            sender: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    const now = new Date();
    const validMessages = messages.filter((msg) => {
      if (msg.ephemeralExpiresAt && msg.ephemeralExpiresAt < now) {
        return false;
      }
      return true;
    });

    return reply.send(validMessages.reverse());
  });

  fastify.post('/send', { preHandler: [authenticate] }, async (request, reply) => {
    const body = sendMessageSchema.parse(request.body);

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: body.chatId, userId: request.user.id } },
    });

    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this chat' });
    }

    let ephemeralExpiresAt: Date | null = null;
    if (body.ephemeralDuration > 0) {
      ephemeralExpiresAt = new Date(Date.now() + body.ephemeralDuration * 1000);
    }

    const message = await prisma.message.create({
      data: {
        chatId: body.chatId,
        senderId: request.user.id,
        encryptedContent: body.encryptedContent,
        nonce: body.nonce,
        messageType: body.messageType,
        ephemeralDuration: body.ephemeralDuration,
        ephemeralExpiresAt,
        viewOnce: body.viewOnce,
        replyToId: body.replyToId,
        attachments: body.attachments
          ? {
              create: body.attachments,
            }
          : undefined,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        attachments: true,
        replyTo: {
          select: {
            id: true,
            senderId: true,
            encryptedContent: true,
            messageType: true,
            sender: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    await prisma.chat.update({
      where: { id: body.chatId },
      data: { updatedAt: new Date() },
    });

    WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'NEW_MESSAGE', message);

    // Send FCM push notification to offline recipients
    const senderName = message.sender?.displayName || message.sender?.username || 'Someone';
    NotificationService.sendMessageNotification(
      body.chatId,
      message.id,
      request.user.id,
      senderName,
      body.encryptedContent,
      body.messageType,
      message.sender?.avatarUrl,
    );

    // Auto Bot Response if sending to @uschat_bot
    const chatMembers = await prisma.chatMember.findMany({
      where: { chatId: body.chatId },
      include: { user: true },
    });

    const botMember = chatMembers.find((m) => m.user.username === 'uschat_bot' && m.userId !== request.user.id);
    if (botMember) {
      setTimeout(async () => {
        const botReplyMessage = await prisma.message.create({
          data: {
            chatId: body.chatId,
            senderId: botMember.userId,
            encryptedContent: '⚡ USCHAT Bot: Signal E2EE connection active! Message received and verified.',
            messageType: 'TEXT',
          },
          include: {
            sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            attachments: true,
          },
        });

        WebSocketManager.broadcastToChat(body.chatId, botMember.userId, 'NEW_MESSAGE', botReplyMessage);
      }, 1000);
    }

    return reply.status(201).send(message);
  });

  fastify.patch('/:messageId/view-once', { preHandler: [authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };

    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || !msg.viewOnce) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Message is not view-once' });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isViewed: true, encryptedContent: '[VIEW_ONCE_EXPIRED]' },
    });

    WebSocketManager.broadcastToChat(msg.chatId, request.user.id, 'VIEW_ONCE_OPENED', { messageId });

    return reply.send(updated);
  });

  fastify.delete('/:messageId/everyone', { preHandler: [authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };

    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    if (msg.senderId !== request.user.id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only sender can delete for everyone' });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeletedForEveryone: true,
        encryptedContent: '[DELETED_MESSAGE]',
      },
    });

    WebSocketManager.broadcastToChat(msg.chatId, request.user.id, 'MESSAGE_DELETED', { messageId });

    return reply.send(updated);
  });

  fastify.patch('/:messageId/edit', { preHandler: [authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const { newContent } = request.body as { newContent: string };

    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) {
      return reply.status(404).send({ error: 'Not Found', message: 'Message not found' });
    }

    if (msg.senderId !== request.user.id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only sender can edit message' });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        encryptedContent: newContent,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    WebSocketManager.broadcastToChat(msg.chatId, request.user.id, 'MESSAGE_EDITED', updated);

    return reply.send(updated);
  });

  fastify.post('/:messageId/react', { preHandler: [authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const { emoji } = request.body as { emoji: string };

    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) {
      return reply.status(404).send({ error: 'Not Found', message: 'Message not found' });
    }

    let reactionsList: Array<{ userId: string; username: string; emoji: string }> = [];
    try {
      reactionsList = JSON.parse(msg.reactions || '[]');
    } catch {
      reactionsList = [];
    }

    const existingIndex = reactionsList.findIndex((r) => r.userId === request.user.id);
    if (existingIndex > -1) {
      if (reactionsList[existingIndex].emoji === emoji) {
        reactionsList.splice(existingIndex, 1);
      } else {
        reactionsList[existingIndex].emoji = emoji;
      }
    } else {
      reactionsList.push({
        userId: request.user.id,
        username: (request.user as any).username || '',
        emoji,
      });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: {
        reactions: JSON.stringify(reactionsList),
      },
    });

    WebSocketManager.broadcastToChat(msg.chatId, request.user.id, 'MESSAGE_REACTED', {
      messageId,
      chatId: msg.chatId,
      reactions: reactionsList,
    });

    return reply.send({ messageId, reactions: reactionsList });
  });
}
