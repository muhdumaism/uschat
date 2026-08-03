import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const createDirectChatSchema = z.object({
  recipientUsername: z.string(),
});

const createGroupChatSchema = z.object({
  name: z.string().min(1).max(100),
  memberUsernames: z.array(z.string()).min(1),
  avatar: z.string().optional(),
});

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const userMemberships = await prisma.chatMember.findMany({
      where: { userId: request.user.id },
      include: {
        chat: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { chat: { updatedAt: 'desc' } },
    });

    const formatted = userMemberships.map((m) => {
      const chat = m.chat;
      const otherMember = chat.members.find((mem) => mem.userId !== request.user.id);
      const isNoteToSelf = chat.type === 'DIRECT' && chat.members.length === 1;
      const peer = isNoteToSelf ? chat.members[0]?.user : (otherMember?.user || chat.members[0]?.user);

      return {
        id: chat.id,
        type: chat.type,
        name: isNoteToSelf ? 'Note to Self (Saved Messages)' : (chat.type === 'DIRECT' ? (peer?.displayName || peer?.username || 'User') : chat.name),
        avatar: chat.type === 'DIRECT' ? peer?.avatarUrl : chat.avatar,
        peerUsername: peer?.username,
        isMuted: m.isMuted,
        isArchived: m.isArchived,
        lastMessage: chat.messages[0] || null,
        members: chat.members.map((mem) => mem.user),
        updatedAt: chat.updatedAt,
      };
    });

    return reply.send(formatted);
  });

  fastify.post('/direct', { preHandler: [authenticate] }, async (request, reply) => {
    const body = createDirectChatSchema.parse(request.body);
    const recipient = await prisma.user.findUnique({
      where: { username: body.recipientUsername.toLowerCase() },
    });

    if (!recipient) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    const isSelf = recipient.id === request.user.id;

    const existing = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: request.user.id } } },
          { members: isSelf ? { every: { userId: request.user.id } } : { some: { userId: recipient.id } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (existing) {
      return reply.send(existing);
    }

    const newChat = await prisma.chat.create({
      data: {
        type: 'DIRECT',
        name: isSelf ? 'Note to Self' : undefined,
        members: {
          create: isSelf
            ? [{ userId: request.user.id, role: 'ADMIN' }]
            : [
                { userId: request.user.id, role: 'ADMIN' },
                { userId: recipient.id, role: 'MEMBER' },
              ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return reply.status(201).send(newChat);
  });

  fastify.post('/group', { preHandler: [authenticate] }, async (request, reply) => {
    const body = createGroupChatSchema.parse(request.body);

    const members = await prisma.user.findMany({
      where: { username: { in: body.memberUsernames.map((u) => u.toLowerCase()) } },
      select: { id: true },
    });

    const memberIds = new Set(members.map((m) => m.id));
    memberIds.add(request.user.id);

    const newGroup = await prisma.chat.create({
      data: {
        type: 'GROUP',
        name: body.name,
        avatar: body.avatar,
        members: {
          create: Array.from(memberIds).map((uid) => ({
            userId: uid,
            role: uid === request.user.id ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return reply.status(201).send(newGroup);
  });

  fastify.patch('/:chatId/mute', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const { isMuted } = request.body as { isMuted: boolean };

    await prisma.chatMember.updateMany({
      where: { chatId, userId: request.user.id },
      data: { isMuted },
    });

    return reply.send({ success: true, isMuted });
  });

  fastify.patch('/:chatId/archive', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const { isArchived } = request.body as { isArchived: boolean };

    await prisma.chatMember.updateMany({
      where: { chatId, userId: request.user.id },
      data: { isArchived },
    });

    return reply.send({ success: true, isArchived });
  });
}
