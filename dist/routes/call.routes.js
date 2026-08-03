"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callRoutes = callRoutes;
const zod_1 = require("zod");
const client_1 = require("../prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const livekit_service_1 = require("../services/livekit.service");
const ws_handler_1 = require("../websocket/ws.handler");
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
                encryptedContent: `${body.type === 'VIDEO' ? '🎥 Video' : '📞 Voice'} Call started`,
                messageType: 'CALL_LOG',
            },
            include: {
                sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            },
        });
        ws_handler_1.WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'NEW_MESSAGE', msg);
        const token = await livekit_service_1.LiveKitService.generateToken(roomName, request.user.id, request.user.username || 'user');
        const initiatorUser = await client_1.prisma.user.findUnique({ where: { id: request.user.id } });
        ws_handler_1.WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'INCOMING_CALL', {
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
        const token = await livekit_service_1.LiveKitService.generateToken(call.roomName, request.user.id, request.user.username || 'user');
        return reply.send({
            call,
            livekitToken: token,
            wsUrl: process.env.LIVEKIT_WS_URL || 'ws://192.168.1.83:7880',
        });
    });
    fastify.post('/:callId/end', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { callId } = request.params;
        try {
            const call = await client_1.prisma.call.update({
                where: { id: callId },
                data: { status: 'ENDED', endedAt: new Date() },
            });
            // Log call end as a system CALL_LOG message
            const msg = await client_1.prisma.message.create({
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
            ws_handler_1.WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'NEW_MESSAGE', msg);
            ws_handler_1.WebSocketManager.broadcastToChat(call.chatId, request.user.id, 'CALL_ENDED', { callId });
            return reply.send(call);
        }
        catch (err) {
            return reply.send({ success: true });
        }
    });
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
                chat: true,
            },
            orderBy: { startedAt: 'desc' },
            take: 50,
        });
        return reply.send(calls);
    });
}
