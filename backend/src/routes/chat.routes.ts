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

  // Get Group Details
  fastify.get('/group/:chatId', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: request.user.id } },
    });

    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You are not a member of this chat' });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
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
      },
    });

    if (!chat || chat.type !== 'GROUP') {
      return reply.status(404).send({ error: 'Not Found', message: 'Group chat not found' });
    }

    return reply.send(chat);
  });

  // Edit Group Settings
  fastify.patch('/group/:chatId', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(250).optional(),
      avatar: z.string().optional().nullable(),
      adminsOnlyMessaging: z.boolean().optional(),
      adminsOnlyInfoEdit: z.boolean().optional(),
    }).parse(request.body);

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: request.user.id } },
    });

    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You are not a member of this chat' });
    }

    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat || chat.type !== 'GROUP') {
      return reply.status(404).send({ error: 'Not Found', message: 'Group chat not found' });
    }

    // If adminsOnlyInfoEdit is true, only admins can edit settings
    if (chat.adminsOnlyInfoEdit && membership.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins can modify this group settings' });
    }

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: body,
    });

    return reply.send(updated);
  });

  // Add Group Members
  fastify.post('/group/:chatId/members', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const { usernames } = z.object({
      usernames: z.array(z.string()).min(1),
    }).parse(request.body);

    const callerMembership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: request.user.id } },
    });

    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only group admins can add members' });
    }

    const users = await prisma.user.findMany({
      where: { username: { in: usernames.map((u) => u.toLowerCase()) } },
      select: { id: true, username: true },
    });

    const existingMembers = await prisma.chatMember.findMany({
      where: {
        chatId,
        userId: { in: users.map((u) => u.id) },
      },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingMembers.map((em) => em.userId));

    const newMembersData = users
      .filter((u) => !existingUserIds.has(u.id))
      .map((u) => ({
        chatId,
        userId: u.id,
        role: 'MEMBER',
      }));

    if (newMembersData.length > 0) {
      await prisma.chatMember.createMany({
        data: newMembersData,
      });
    }

    return reply.send({ success: true, added: users.map((u) => u.username) });
  });

  // Remove Group Member
  fastify.delete('/group/:chatId/members/:userId', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId, userId } = request.params as { chatId: string; userId: string };

    const callerMembership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: request.user.id } },
    });

    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only group admins can remove members' });
    }

    await prisma.chatMember.delete({
      where: { chatId_userId: { chatId, userId } },
    });

    return reply.send({ success: true });
  });

  // Change Member Role
  fastify.patch('/group/:chatId/members/:userId/role', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId, userId } = request.params as { chatId: string; userId: string };
    const { role } = z.object({
      role: z.enum(['ADMIN', 'MEMBER']),
    }).parse(request.body);

    const callerMembership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: request.user.id } },
    });

    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only group admins can manage member roles' });
    }

    await prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { role },
    });

    return reply.send({ success: true });
  });

  // Leave Group
  fastify.post('/group/:chatId/leave', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };

    await prisma.chatMember.delete({
      where: { chatId_userId: { chatId, userId: request.user.id } },
    });

    // Clean up group chat if no members remain
    const membersCount = await prisma.chatMember.count({ where: { chatId } });
    if (membersCount === 0) {
      await prisma.chat.delete({ where: { id: chatId } });
    }

    return reply.send({ success: true });
  });

  // Pin/Unpin Message
  fastify.post('/group/:chatId/pin/:messageId', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId, messageId } = request.params as { chatId: string; messageId: string };

    const callerMembership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: request.user.id } },
    });

    if (!callerMembership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You are not a member of this chat' });
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.chatId !== chatId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Message not found in this chat' });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isPinned: !message.isPinned },
    });

    return reply.send({ success: true, isPinned: updated.isPinned });
  });

  // Get Pinned Messages
  fastify.get('/group/:chatId/pins', { preHandler: [authenticate] }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string };

    const callerMembership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: request.user.id } },
    });

    if (!callerMembership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You are not a member of this chat' });
    }

    const pins = await prisma.message.findMany({
      where: { chatId, isPinned: true },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
      },
    });

    return reply.send(pins);
  });
}
