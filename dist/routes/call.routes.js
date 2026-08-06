"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callRoutes = callRoutes;
const zod_1 = require("zod");
const client_1 = require("../prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const livekit_service_1 = require("../services/livekit.service");
const ws_handler_1 = require("../websocket/ws.handler");
const notification_service_1 = require("../services/notification.service");
const initiateCallSchema = zod_1.z.object({
    chatId: zod_1.z.string(),
    type: zod_1.z.string().default('AUDIO'),
});
async function callRoutes(fastify) {
    fastify.post('/initiate', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const body = initiateCallSchema.parse(request.body);
        const roomName = `uschat_room_${body.chatId}_${Date.now()}`;
        const call = await client_1.prisma.call.create({
            data: {
                chatId: body.chatId,
                initiatorId: request.user.id,
                type: body.type,
                roomName,
                status: 'RINGING',
            },
        });
        // Log call start as a system CALL_LOG message
        const msg = await client_1.prisma.message.create({
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
        ws_handler_1.WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'NEW_MESSAGE', msg);
        const token = await livekit_service_1.LiveKitService.generateToken(roomName, request.user.id, request.user.username || 'user');
        const initiatorUser = await client_1.prisma.user.findUnique({ where: { id: request.user.id } });
        const callerName = initiatorUser?.displayName || initiatorUser?.username || 'Caller';
        // WebSocket broadcast for online users
        ws_handler_1.WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'INCOMING_CALL', {
            callId: call.id,
            chatId: body.chatId,
            initiatorId: request.user.id,
            initiatorName: callerName,
            type: body.type,
            roomName,
            callerAvatar: initiatorUser?.avatarUrl,
        });
        // FCM push for offline users (high priority, wakes device)
        notification_service_1.NotificationService.sendIncomingCallNotification(body.chatId, call.id, request.user.id, callerName, roomName, body.type, initiatorUser?.avatarUrl);
        return reply.status(201).send({
            call,
            livekitToken: token,
            wsUrl: process.env.LIVEKIT_WS_URL || 'wss://layal-8xlj73s2.livekit.cloud',
        });
    });
    fastify.post('/:callId/join', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { callId } = request.params;
        const call = await client_1.prisma.call.findUnique({ where: { id: callId } });
        if (!call || call.status === 'ENDED') {
            return reply.status(400).send({ error: 'Bad Request', message: 'Call is no longer active' });
        }
        await client_1.prisma.call.update({
            where: { id: callId },
            data: { status: 'ONGOING' },
        });
        // Notify the initiator that the call was accepted
        ws_handler_1.WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'CALL_ACCEPTED', {
            callId,
            chatId: call.chatId,
            acceptedBy: request.user.id,
        });
        const token = await livekit_service_1.LiveKitService.generateToken(call.roomName, request.user.id, request.user.username || 'user');
        return reply.send({
            call,
            livekitToken: token,
            wsUrl: process.env.LIVEKIT_WS_URL || 'wss://layal-8xlj73s2.livekit.cloud',
        });
    });
    fastify.post('/:callId/end', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { callId } = request.params;
        try {
            const call = await client_1.prisma.call.update({
                where: { id: callId },
                data: { status: 'ENDED', endedAt: new Date() },
            });
            // Calculate duration to determine if it's a missed call
            const durationMs = call.endedAt && call.startedAt
                ? new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()
                : 0;
            const wasMissed = durationMs < 5000 && call.status !== 'ONGOING';
            // Log call end as a system CALL_LOG message
            const msg = await client_1.prisma.message.create({
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
            ws_handler_1.WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'NEW_MESSAGE', msg);
            ws_handler_1.WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'CALL_ENDED', { callId });
            // Send cancel notification (removes incoming call notif on peer's device)
            notification_service_1.NotificationService.sendCallCancelledNotification(call.chatId, callId, request.user.id);
            // If missed, send missed call push notification
            if (wasMissed) {
                const initiator = await client_1.prisma.user.findUnique({ where: { id: call.initiatorId } });
                const callerName = initiator?.displayName || initiator?.username || 'Someone';
                // Find recipients (non-initiator chat members)
                const members = await client_1.prisma.chatMember.findMany({
                    where: { chatId: call.chatId, userId: { not: call.initiatorId } },
                    select: { userId: true },
                });
                for (const m of members) {
                    notification_service_1.NotificationService.sendMissedCallNotification(call.chatId, callId, m.userId, callerName);
                }
            }
            return reply.send(call);
        }
        catch (err) {
            return reply.send({ success: true });
        }
    });
    fastify.post('/:callId/decline', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { callId } = request.params;
        try {
            const call = await client_1.prisma.call.update({
                where: { id: callId },
                data: { status: 'ENDED', endedAt: new Date() },
            });
            // Log call decline as a system CALL_LOG message
            const msg = await client_1.prisma.message.create({
                data: {
                    chatId: call.chatId,
                    senderId: request.user.id,
                    encryptedContent: `📞 Call declined`,
                    messageType: 'CALL_LOG',
                },
                include: {
                    sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                },
            });
            ws_handler_1.WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'NEW_MESSAGE', msg);
            ws_handler_1.WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'CALL_ENDED', { callId, reason: 'DECLINED' });
            // Send cancel notification (removes incoming call notif on peer's device)
            notification_service_1.NotificationService.sendCallCancelledNotification(call.chatId, callId, request.user.id);
            return reply.send(call);
        }
        catch (err) {
            return reply.send({ success: true });
        }
    });
    // Call history — deduplicated, with direction and duration
    fastify.get('/history', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const calls = await client_1.prisma.call.findMany({
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
