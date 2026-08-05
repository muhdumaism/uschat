import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { LiveKitService } from '../services/livekit.service';
import { WebSocketManager } from '../websocket/ws.handler';
import { NotificationService } from '../services/notification.service';

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
        encryptedContent: body.type === 'VIDEO' ? `📹 Video Call started` : `📞 Voice Call started`,
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
    const callerName = initiatorUser?.displayName || initiatorUser?.username || 'Caller';

    // WebSocket broadcast for online users
    WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'INCOMING_CALL', {
      callId: call.id,
      chatId: body.chatId,
      initiatorId: request.user.id,
      initiatorName: callerName,
      type: body.type,
      roomName,
      callerAvatar: initiatorUser?.avatarUrl,
    });

    // FCM push for offline users (high priority, wakes device)
    NotificationService.sendIncomingCallNotification(
      body.chatId,
      call.id,
      request.user.id,
      callerName,
      roomName,
      body.type,
      initiatorUser?.avatarUrl,
    );

    return reply.status(201).send({
      call,
      livekitToken: token,
      wsUrl: process.env.LIVEKIT_WS_URL || 'wss://layal-8xlj73s2.livekit.cloud',
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

    // Notify the initiator that the call was accepted
    WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'CALL_ACCEPTED', {
      callId,
      chatId: call.chatId,
      acceptedBy: request.user.id,
    });

    const token = await LiveKitService.generateToken(
      call.roomName,
      request.user.id,
      request.user.username || 'user'
    );

    return reply.send({
      call,
      livekitToken: token,
      wsUrl: process.env.LIVEKIT_WS_URL || 'wss://layal-8xlj73s2.livekit.cloud',
    });
  });

  fastify.post('/:callId/end', { preHandler: [authenticate] }, async (request, reply) => {
    const { callId } = request.params as { callId: string };

    try {
      const call = await prisma.call.update({
        where: { id: callId },
        data: { status: 'ENDED', endedAt: new Date() },
      });

      // Calculate duration to determine if it's a missed call
      const durationMs = call.endedAt && call.startedAt
        ? new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()
        : 0;
      const wasMissed = durationMs < 5000 && call.status !== 'ONGOING';

      // Log call end as a system CALL_LOG message
      const msg = await prisma.message.create({
        data: {
          chatId: call.chatId,
          senderId: request.user.id,
          encryptedContent: wasMissed ? `📞 Missed Call` : `📞 Voice Call ended`,
          messageType: 'CALL_LOG',
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'NEW_MESSAGE', msg);
      WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'CALL_ENDED', { callId });

      // Send cancel notification (removes incoming call notif on peer's device)
      NotificationService.sendCallCancelledNotification(call.chatId, callId, request.user.id);

      // If missed, send missed call push notification
      if (wasMissed) {
        const initiator = await prisma.user.findUnique({ where: { id: call.initiatorId } });
        const callerName = initiator?.displayName || initiator?.username || 'Someone';

        // Find recipients (non-initiator chat members)
        const members = await prisma.chatMember.findMany({
          where: { chatId: call.chatId, userId: { not: call.initiatorId } },
          select: { userId: true },
        });
        for (const m of members) {
          NotificationService.sendMissedCallNotification(call.chatId, callId, m.userId, callerName);
        }
      }

      return reply.send(call);
    } catch (err) {
      return reply.send({ success: true });
    }
  });

  // Call history — deduplicated, with direction and duration
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
        chat: {
          include: {
            members: {
              include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
      distinct: ['roomName'], // Deduplicate by roomName
    });

    // Enrich with direction, duration, missed status
    const enriched = calls.map((call) => {
      const isOutgoing = call.initiatorId === request.user.id;
      const durationMs = call.endedAt && call.startedAt
        ? new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()
        : 0;
      const durationSec = Math.max(0, Math.floor(durationMs / 1000));
      const isMissed = call.status === 'ENDED' && durationSec < 5;

      // Get the peer (the other person in the call)
      const peer = call.chat.members.find((m) => m.userId !== request.user.id);

      return {
        id: call.id,
        chatId: call.chatId,
        roomName: call.roomName,
        type: call.type,
        status: call.status,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        isMissed,
        durationSec,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        initiator: call.initiator,
        peer: peer?.user || call.initiator,
      };
    });

    return reply.send(enriched);
  });
}
