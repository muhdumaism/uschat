import { WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma/client';

interface ConnectedClient {
  userId: string;
  deviceId?: string;
  ws: WebSocket;
  activeChatId?: string; // which chat the user currently has open
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

  /**
   * Check if user has a specific chat open (for notification suppression)
   */
  public static isUserViewingChat(userId: string, chatId: string): boolean {
    const conns = this.connections.get(userId);
    if (!conns) return false;
    return conns.some((c) => c.activeChatId === chatId);
  }

  /**
   * Set the active chat for a user connection
   */
  public static setUserActiveChat(userId: string, ws: WebSocket, chatId: string | null) {
    const conns = this.connections.get(userId);
    if (!conns) return;
    const conn = conns.find((c) => c.ws === ws);
    if (conn) {
      conn.activeChatId = chatId || undefined;
    }
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
              try {
                await prisma.message.updateMany({
                  where: {
                    chatId: payload.chatId,
                    senderId: { not: decoded.id },
                    isViewed: false,
                  },
                  data: {
                    isViewed: true,
                  },
                });
              } catch (err) {
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
        } catch (err) {
          console.error('WS Frame Error:', err);
        }
      });
    } catch {
      socket.close(4001, 'Invalid Token');
    }
  });
}
