"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
exports.registerWebSocketRoutes = registerWebSocketRoutes;
const ws_1 = require("ws");
const client_1 = require("../prisma/client");
class WebSocketManager {
    static connections = new Map();
    static addConnection(userId, deviceId, ws) {
        const userConns = this.connections.get(userId) || [];
        userConns.push({ userId, deviceId, ws });
        this.connections.set(userId, userConns);
        this.broadcastUserStatus(userId, true);
        ws.on('close', () => {
            this.removeConnection(userId, ws);
        });
    }
    static removeConnection(userId, ws) {
        const userConns = this.connections.get(userId) || [];
        const updated = userConns.filter((c) => c.ws !== ws);
        if (updated.length > 0) {
            this.connections.set(userId, updated);
        }
        else {
            this.connections.delete(userId);
            this.broadcastUserStatus(userId, false);
        }
    }
    static sendToUser(userId, event, payload) {
        const userConns = this.connections.get(userId);
        if (userConns) {
            const data = JSON.stringify({ event, payload });
            userConns.forEach((c) => {
                if (c.ws.readyState === ws_1.WebSocket.OPEN) {
                    c.ws.send(data);
                }
            });
        }
    }
    static broadcastToChat(chatId, senderId, event, payload) {
        client_1.prisma.chatMember.findMany({
            where: { chatId },
            select: { userId: true },
        }).then((members) => {
            members.forEach((m) => {
                if (m.userId !== senderId) {
                    this.sendToUser(m.userId, event, payload);
                }
            });
        }).catch(console.error);
    }
    static isUserOnline(userId) {
        return this.connections.has(userId);
    }
    /**
     * Check if user has a specific chat open (for notification suppression)
     */
    static isUserViewingChat(userId, chatId) {
        const conns = this.connections.get(userId);
        if (!conns)
            return false;
        return conns.some((c) => c.activeChatId === chatId);
    }
    /**
     * Set the active chat for a user connection
     */
    static setUserActiveChat(userId, ws, chatId) {
        const conns = this.connections.get(userId);
        if (!conns)
            return;
        const conn = conns.find((c) => c.ws === ws);
        if (conn) {
            conn.activeChatId = chatId || undefined;
        }
    }
    static broadcastUserStatus(userId, isOnline) {
        client_1.prisma.chatMember.findMany({
            where: { userId },
            select: { chatId: true },
        }).then((chats) => {
            const chatIds = chats.map((c) => c.chatId);
            client_1.prisma.chatMember.findMany({
                where: { chatId: { in: chatIds } },
                select: { userId: true },
            }).then((peerMembers) => {
                const uniquePeers = new Set(peerMembers.map((pm) => pm.userId));
                uniquePeers.delete(userId);
                uniquePeers.forEach((peerId) => {
                    this.sendToUser(peerId, 'USER_STATUS_CHANGE', { userId, isOnline, timestamp: new Date() });
                });
            });
        });
    }
}
exports.WebSocketManager = WebSocketManager;
function registerWebSocketRoutes(fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
        const socket = connection.socket || connection;
        const token = req.query?.token;
        if (!token) {
            socket.close(4001, 'Unauthorized');
            return;
        }
        try {
            const decoded = fastify.jwt.verify(token);
            WebSocketManager.addConnection(decoded.id, decoded.deviceId, socket);
            socket.on('message', async (rawMessage) => {
                try {
                    const { event, payload } = JSON.parse(rawMessage.toString());
                    switch (event) {
                        case 'TYPING_START':
                            WebSocketManager.broadcastToChat(payload.chatId, decoded.id, 'TYPING_START', {
                                chatId: payload.chatId,
                                userId: decoded.id,
                            });
                            break;
                        case 'TYPING_STOP':
                            WebSocketManager.broadcastToChat(payload.chatId, decoded.id, 'TYPING_STOP', {
                                chatId: payload.chatId,
                                userId: decoded.id,
                            });
                            break;
                        case 'READ_RECEIPT':
                            try {
                                await client_1.prisma.message.updateMany({
                                    where: {
                                        chatId: payload.chatId,
                                        senderId: { not: decoded.id },
                                        isViewed: false,
                                    },
                                    data: {
                                        isViewed: true,
                                    },
                                });
                            }
                            catch (err) {
                                console.error('Error updating read receipts in database:', err);
                            }
                            WebSocketManager.broadcastToChat(payload.chatId, decoded.id, 'READ_RECEIPT', {
                                chatId: payload.chatId,
                                userId: decoded.id,
                                readAt: new Date(),
                            });
                            break;
                        // Track which chat the user has open (for notification suppression)
                        case 'CHAT_OPENED':
                            WebSocketManager.setUserActiveChat(decoded.id, socket, payload.chatId);
                            break;
                        case 'CHAT_CLOSED':
                            WebSocketManager.setUserActiveChat(decoded.id, socket, null);
                            break;
                        default:
                            break;
                    }
                }
                catch (err) {
                    console.error('WS Frame Error:', err);
                }
            });
        }
        catch {
            socket.close(4001, 'Invalid Token');
        }
    });
}
