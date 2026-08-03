"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRoutes = messageRoutes;
const zod_1 = require("zod");
const client_1 = require("../prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ws_handler_1 = require("../websocket/ws.handler");
const sendMessageSchema = zod_1.z.object({
    chatId: zod_1.z.string(),
    encryptedContent: zod_1.z.string(),
    nonce: zod_1.z.string().optional(),
    messageType: zod_1.z.string().default('TEXT'),
    ephemeralDuration: zod_1.z.number().int().min(0).default(0),
    viewOnce: zod_1.z.boolean().default(false),
    replyToId: zod_1.z.string().optional(),
    attachments: zod_1.z.array(zod_1.z.object({
        fileUrl: zod_1.z.string(),
        fileType: zod_1.z.string(),
        fileSizeBytes: zod_1.z.number(),
        encryptedKey: zod_1.z.string(),
        initializationVector: zod_1.z.string(),
    })).optional(),
});
async function messageRoutes(fastify) {
    fastify.get('/:chatId', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { chatId } = request.params;
        const { limit = '50', before } = request.query;
        const take = parseInt(limit, 10);
        const where = { chatId };
        if (before) {
            where.createdAt = { lt: new Date(before) };
        }
        const messages = await client_1.prisma.message.findMany({
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
    fastify.post('/send', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const body = sendMessageSchema.parse(request.body);
        const membership = await client_1.prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId: body.chatId, userId: request.user.id } },
        });
        if (!membership) {
            return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this chat' });
        }
        let ephemeralExpiresAt = null;
        if (body.ephemeralDuration > 0) {
            ephemeralExpiresAt = new Date(Date.now() + body.ephemeralDuration * 1000);
        }
        const message = await client_1.prisma.message.create({
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
            },
        });
        await client_1.prisma.chat.update({
            where: { id: body.chatId },
            data: { updatedAt: new Date() },
        });
        ws_handler_1.WebSocketManager.broadcastToChat(body.chatId, request.user.id, 'NEW_MESSAGE', message);
        // Auto Bot Response if sending to @uschat_bot
        const chatMembers = await client_1.prisma.chatMember.findMany({
            where: { chatId: body.chatId },
            include: { user: true },
        });
        const botMember = chatMembers.find((m) => m.user.username === 'uschat_bot' && m.userId !== request.user.id);
        if (botMember) {
            setTimeout(async () => {
                const botReplyMessage = await client_1.prisma.message.create({
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
                ws_handler_1.WebSocketManager.broadcastToChat(body.chatId, botMember.userId, 'NEW_MESSAGE', botReplyMessage);
            }, 1000);
        }
        return reply.status(201).send(message);
    });
    fastify.patch('/:messageId/view-once', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { messageId } = request.params;
        const msg = await client_1.prisma.message.findUnique({ where: { id: messageId } });
        if (!msg || !msg.viewOnce) {
            return reply.status(400).send({ error: 'Bad Request', message: 'Message is not view-once' });
        }
        const updated = await client_1.prisma.message.update({
            where: { id: messageId },
            data: { isViewed: true, encryptedContent: '[VIEW_ONCE_EXPIRED]' },
        });
        ws_handler_1.WebSocketManager.broadcastToChat(msg.chatId, request.user.id, 'VIEW_ONCE_OPENED', { messageId });
        return reply.send(updated);
    });
    fastify.delete('/:messageId/everyone', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { messageId } = request.params;
        const msg = await client_1.prisma.message.findUnique({ where: { id: messageId } });
        if (!msg) {
            return reply.status(404).send({ error: 'Not Found' });
        }
        if (msg.senderId !== request.user.id) {
            return reply.status(403).send({ error: 'Forbidden', message: 'Only sender can delete for everyone' });
        }
        const updated = await client_1.prisma.message.update({
            where: { id: messageId },
            data: {
                isDeletedForEveryone: true,
                encryptedContent: '[DELETED_MESSAGE]',
            },
        });
        ws_handler_1.WebSocketManager.broadcastToChat(msg.chatId, request.user.id, 'MESSAGE_DELETED', { messageId });
        return reply.send(updated);
    });
}
