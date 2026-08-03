import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { LiveKitService } from '../services/livekit.service';
import { WebSocketManager } from '../websocket/ws.handler';

const initiateCallSchema = z.object({
  chatId: z.string(),
  type: z.string().default('AUDIO'),
});

export async function callRoutes(fastify: FastifyInstance) {
  fastify.post('/initiate', { preHandler: [authenticate] }, async (request, reply) => {
    const body = initiateCallSchema.parse(request.body);
    const roomName = `uschat_room_${body.chatId}_${Date.now()}`;

    const call = await prisma.call.create({
      data: {
        chatId: body.chatId,
        initiatorId: request.user.id,
        type: body.type,
        roomName,
        status: 'RINGING',
      },
    });

    // Log call start as a system CALL_LOG message
    const msg = await prisma.message.create({
      data: {
        chatId: body.chatId,
        senderId: request.user.id,
        encryptedContent: `${body.type === 'VIDEO' ? '🎥 Video' : '📞 Voice'} Call started`,
        messageType: 'CALL_LOG',
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'NEW_MESSAGE', msg);

    const token = await LiveKitService.generateToken(
      roomName,
      request.user.id,
      request.user.username || 'user'
    );

    const initiatorUser = await prisma.user.findUnique({ where: { id: request.user.id } });

    WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'INCOMING_CALL', {
      callId: call.id,
      chatId: body.chatId,
      initiatorId: request.user.id,
      initiatorName: initiatorUser?.displayName || initiatorUser?.username || 'Caller',
      type: body.type,
      roomName,
    });

    return reply.status(201).send({
      call,
      livekitToken: token,
      wsUrl: process.env.LIVEKIT_WS_URL || 'ws://192.168.1.83:7880',
    });
  });

  fastify.post('/:callId/join', { preHandler: [authenticate] }, async (request, reply) => {
    const { callId } = request.params as { callId: string };
    const call = await prisma.call.findUnique({ where: { id: callId } });

    if (!call || call.status === 'ENDED') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Call is no longer active' });
    }

    await prisma.call.update({
      where: { id: callId },
      data: { status: 'ONGOING' },
    });

    const token = await LiveKitService.generateToken(
      call.roomName,
      request.user.id,
      request.user.username || 'user'
    );

    return reply.send({
      call,
      livekitToken: token,
      wsUrl: process.env.LIVEKIT_WS_URL || 'ws://192.168.1.83:7880',
    });
  });

  fastify.post('/:callId/end', { preHandler: [authenticate] }, async (request, reply) => {
    const { callId } = request.params as { callId: string };

    try {
      const call = await prisma.call.update({
        where: { id: callId },
        data: { status: 'ENDED', endedAt: new Date() },
      });

      // Log call end as a system CALL_LOG message
      const msg = await prisma.message.create({
        data: {
          chatId: call.chatId,
          senderId: request.user.id,
          encryptedContent: `${call.type === 'VIDEO' ? '🎥 Video' : '📞 Voice'} Call ended`,
          messageType: 'CALL_LOG',
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'NEW_MESSAGE', msg);
      WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'CALL_ENDED', { callId });

      return reply.send(call);
    } catch (err) {
      return reply.send({ success: true });
    }
  });

  fastify.get('/history', { preHandler: [authenticate] }, async (request, reply) => {
    const calls = await prisma.call.findMany({
      where: {
        chat: {
          members: {
            some: { userId: request.user.id },
          },
        },
      },
      include: {
        initiator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        chat: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    return reply.send(calls);
  });
}
