import { WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma/client';

interface ConnectedClient {
  userId: string;
  deviceId?: string;
  ws: WebSocket;
}

export class WebSocketManager {
  private static connections = new Map<string, ConnectedClient[]>();

  public static addConnection(userId: string, deviceId: string | undefined, ws: WebSocket) {
    const userConns = this.connections.get(userId) || [];
    userConns.push({ userId, deviceId, ws });
    this.connections.set(userId, userConns);

    this.broadcastUserStatus(userId, true);

    ws.on('close', () => {
      this.removeConnection(userId, ws);
    });
  }

  public static removeConnection(userId: string, ws: WebSocket) {
    const userConns = this.connections.get(userId) || [];
    const updated = userConns.filter((c) => c.ws !== ws);
    if (updated.length > 0) {
      this.connections.set(userId, updated);
    } else {
      this.connections.delete(userId);
      this.broadcastUserStatus(userId, false);
    }
  }

  public static sendToUser(userId: string, event: string, payload: any) {
    const userConns = this.connections.get(userId);
    if (userConns) {
      const data = JSON.stringify({ event, payload });
      userConns.forEach((c) => {
        if (c.ws.readyState === WebSocket.OPEN) {
          c.ws.send(data);
        }
      });
    }
  }

  public static broadcastToChat(chatId: string, senderId: string, event: string, payload: any) {
    prisma.chatMember.findMany({
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

  public static isUserOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  private static broadcastUserStatus(userId: string, isOnline: boolean) {
    prisma.chatMember.findMany({
      where: { userId },
      select: { chatId: true },
    }).then((chats) => {
      const chatIds = chats.map((c) => c.chatId);
      prisma.chatMember.findMany({
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

export function registerWebSocketRoutes(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (connection: any, req) => {
    const socket: WebSocket = connection.socket || connection;

    const token = (req.query as any)?.token;
    if (!token) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    try {
      const decoded = fastify.jwt.verify<{ id: string; deviceId?: string }>(token);
      WebSocketManager.addConnection(decoded.id, decoded.deviceId, socket);

      socket.on('message', async (rawMessage: Buffer) => {
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
              WebSocketManager.broadcastToChat(payload.chatId, decoded.id, 'READ_RECEIPT', {
                chatId: payload.chatId,
                messageId: payload.messageId,
                userId: decoded.id,
                readAt: new Date(),
              });
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('WS Frame Error:', err);
        }
      });
    } catch {
      socket.close(4001, 'Invalid Token');
    }
  });
}
