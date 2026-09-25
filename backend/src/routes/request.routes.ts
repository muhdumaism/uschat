import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const sendRequestSchema = z.object({
  receiverUsername: z.string().min(3).max(30),
});

const respondRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
});

export async function requestRoutes(fastify: FastifyInstance) {
  // 1. Get Pending Requests (both incoming and outgoing)
  fastify.get('/pending', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;

    const incoming = await prisma.messageRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      select: {
        id: true,
        senderId: true,
        createdAt: true,
      },
    });

    const outgoing = await prisma.messageRequest.findMany({
      where: {
        senderId: userId,
        status: 'PENDING',
      },
      select: {
        id: true,
        receiverId: true,
        createdAt: true,
      },
    });

    // Populate user profile info for sender/receiver
    const incomingPopulated = await Promise.all(
      incoming.map(async (req) => {
        const sender = await prisma.user.findUnique({
          where: { id: req.senderId },
          select: { username: true, displayName: true, avatarUrl: true },
        });
        return { ...req, sender };
      })
    );

    const outgoingPopulated = await Promise.all(
      outgoing.map(async (req) => {
        const receiver = await prisma.user.findUnique({
          where: { id: req.receiverId },
          select: { username: true, displayName: true, avatarUrl: true },
        });
        return { ...req, receiver };
      })
    );

    return reply.send({
      incoming: incomingPopulated,
      outgoing: outgoingPopulated,
    });
  });

  // 2. Send a Message Request
  fastify.post('/send', { preHandler: [authenticate] }, async (request, reply) => {
    const senderId = request.user.id;
    const body = sendRequestSchema.parse(request.body);

    const receiver = await prisma.user.findUnique({
      where: { username: body.receiverUsername.toLowerCase() },
    });

    if (!receiver) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'The requested username does not exist.',
      });
    }

    if (receiver.id === senderId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'You cannot send a message request to yourself.',
      });
    }

    // Check if a direct chat session already exists between these users
    const existingChat = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: senderId } } },
          { members: { some: { userId: receiver.id } } },
        ],
      },
    });

    if (existingChat) {
      return reply.status(400).send({
        error: 'Conflict',
        message: 'A chat session already exists with this user.',
      });
    }

    // Check if a request is already pending
    const existingReq = await prisma.messageRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: senderId },
        ],
      },
    });

    if (existingReq) {
      if (existingReq.status === 'PENDING') {
        return reply.status(400).send({
          error: 'Conflict',
          message: 'A message request is already pending between you and this user.',
        });
      } else if (existingReq.status === 'ACCEPTED') {
        return reply.status(400).send({
          error: 'Conflict',
          message: 'You have already accepted a message request from this user.',
        });
      }
    }

    // Create the message request
    const newReq = await prisma.messageRequest.create({
      data: {
        senderId,
        receiverId: receiver.id,
        status: 'PENDING',
      },
    });

    return reply.status(201).send({
      message: 'Message request sent successfully.',
      request: newReq,
    });
  });

  // 3. Respond to a Message Request
  fastify.post('/respond', { preHandler: [authenticate] }, async (request, reply) => {
    const receiverId = request.user.id;
    const body = respondRequestSchema.parse(request.body);

    const messageReq = await prisma.messageRequest.findUnique({
      where: { id: body.requestId },
    });

    if (!messageReq || messageReq.receiverId !== receiverId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Message request not found.',
      });
    }

    if (messageReq.status !== 'PENDING') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'This request has already been processed.',
      });
    }

    if (body.action === 'decline') {
      // Delete the request so the sender can re-request later
      await prisma.messageRequest.delete({
        where: { id: body.requestId },
      });

      return reply.send({
        message: 'Message request declined and deleted.',
      });
    }

    // If accepted:
    // 1. Mark request as accepted
    await prisma.messageRequest.update({
      where: { id: body.requestId },
      data: { status: 'ACCEPTED' },
    });

    // 2. Create standard DIRECT chat
    const newChat = await prisma.chat.create({
      data: {
        type: 'DIRECT',
      },
    });

    // 3. Add members
    await prisma.chatMember.createMany({
      data: [
        { chatId: newChat.id, userId: messageReq.senderId, role: 'MEMBER' },
        { chatId: newChat.id, userId: receiverId, role: 'MEMBER' },
      ],
    });

    return reply.send({
      message: 'Message request accepted. Chat session established.',
      chatId: newChat.id,
    });
  });

  // 4. Cancel a sent request
  fastify.delete('/cancel/:requestId', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const { requestId } = request.params as { requestId: string };

    const messageReq = await prisma.messageRequest.findUnique({
      where: { id: requestId },
    });

    if (!messageReq || messageReq.senderId !== userId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Outgoing request not found.',
      });
    }

    await prisma.messageRequest.delete({
      where: { id: requestId },
    });

    return reply.send({
      message: 'Outgoing message request cancelled.',
    });
  });
}
