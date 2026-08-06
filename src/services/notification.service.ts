import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma/client';
import { config } from '../config';
import { WebSocketManager } from '../websocket/ws.handler';

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized || getApps().length > 0) {
    firebaseInitialized = true;
    return;
  }

  let saPath = path.resolve(config.firebase.serviceAccountPath);
  if (!fs.existsSync(saPath)) {
    try {
      const rootDir = path.resolve(path.join(__dirname, '../../'));
      const searchDirs = [
        rootDir,
        path.join(rootDir, 'backend'),
        path.join(rootDir, '../'),
      ];

      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          const candidate = files.find(file => file.includes('firebase-adminsdk') && file.endsWith('.json'));
          if (candidate) {
            saPath = path.join(dir, candidate);
            break;
          }
        }
      }
    } catch (e) {}
  }

  if (!fs.existsSync(saPath)) {
    console.warn('[NotificationService] Firebase service account not found at', saPath);
    console.warn('[NotificationService] Push notifications will operate in WebSocket-only fallback mode.');
    return;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log('[NotificationService] Firebase initialized successfully ✓');
  } catch (err: any) {
    console.error('[NotificationService] Failed to initialize Firebase Admin SDK:', err.message);
  }
}

// Initialize on module load
initFirebase();

function getMessageTypeLabel(messageType: string): string {
  switch (messageType) {
    case 'IMAGE': return '📷 Photo';
    case 'VIDEO': return '🎥 Video';
    case 'FILE': return '📄 Document';
    case 'VOICE': return '🎤 Voice message';
    case 'CALL_LOG': return '📞 Call';
    default: return '';
  }
}

export class NotificationService {

  /**
   * Register or update an FCM token for a user/device
   */
  static async registerToken(userId: string, token: string, platform: string = 'android', deviceId?: string) {
    try {
      console.log(`[NotificationService] Registering token for user ${userId}...`);
      await prisma.pushToken.upsert({
        where: { token },
        create: {
          userId,
          token,
          platform,
          deviceId: deviceId || null,
          isValid: true,
          lastUsedAt: new Date(),
        },
        update: {
          userId,
          platform,
          deviceId: deviceId || null,
          isValid: true,
          lastUsedAt: new Date(),
        },
      });
      console.log(`[NotificationService] Push token registered successfully for user ${userId} [Platform: ${platform}]`);
    } catch (err: any) {
      console.error('[NotificationService] registerToken error:', err.message);
    }
  }

  /**
   * Remove an FCM token (e.g. on logout)
   */
  static async unregisterToken(token: string) {
    try {
      console.log(`[NotificationService] Unregistering token: ${token}`);
      const result = await prisma.pushToken.deleteMany({ where: { token } });
      console.log(`[NotificationService] Unregistered token successfully. Deleted rows: ${result.count}`);
    } catch (err: any) {
      console.error('[NotificationService] unregisterToken error:', err.message);
    }
  }

  /**
   * Remove all invalid tokens for a user
   */
  static async cleanInvalidTokens(userId: string) {
    try {
      console.log(`[NotificationService] Cleaning invalid tokens for user ${userId}`);
      const result = await prisma.pushToken.deleteMany({ where: { userId, isValid: false } });
      console.log(`[NotificationService] Cleaned up ${result.count} invalid tokens`);
    } catch (err: any) {
      console.error('[NotificationService] cleanInvalidTokens error:', err.message);
    }
  }

  /**
   * Send a message push notification to all offline/non-viewing recipients in a chat
   */
  static async sendMessageNotification(
    chatId: string,
    senderId: string,
    senderName: string,
    messageBody: string,
    messageType: string,
    senderAvatar?: string | null,
  ) {
    try {
      console.log(`[NotificationService] Creating message notification from ${senderName} (ID: ${senderId}) in Chat ${chatId}`);
      // Find all chat members except the sender
      const members = await prisma.chatMember.findMany({
        where: { chatId, userId: { not: senderId } },
        select: { userId: true },
      });

      const bodyText = messageType !== 'TEXT'
        ? getMessageTypeLabel(messageType)
        : messageBody.length > 120
          ? messageBody.substring(0, 120) + '...'
          : messageBody;

      const timestamp = new Date().toISOString();

      for (const member of members) {
        // Skip if recipient has the app open and is actively viewing this specific chat screen
        if (WebSocketManager.isUserViewingChat(member.userId, chatId)) {
          console.log(`[NotificationService] User ${member.userId} is actively viewing Chat ${chatId}. Suppressing push notification.`);
          continue;
        }

        // Fetch unread count for badge update
        const unreadCount = await prisma.message.count({
          where: {
            chatId,
            senderId: { not: member.userId },
          },
        });

        console.log(`[NotificationService] Dispatching message notification to user ${member.userId} (unread count: ${unreadCount})`);

        await this.sendToUser(member.userId, {
          title: senderName,
          body: bodyText,
          imageUrl: senderAvatar || undefined,
        }, {
          type: 'message',
          senderId,
          conversationId: chatId,
          senderName,
          avatar: senderAvatar || '',
          message: bodyText,
          timestamp,
          badgeCount: String(unreadCount),
        }, 'messages');
      }
    } catch (err: any) {
      console.error('[NotificationService] sendMessageNotification error:', err.message);
    }
  }

  /**
   * Send high-priority incoming call push notification (wakes phone screen and triggers ring UI)
   */
  static async sendIncomingCallNotification(
    chatId: string,
    callId: string,
    callerId: string,
    callerName: string,
    roomName: string,
    callType: string = 'AUDIO',
    callerAvatar?: string | null,
  ) {
    try {
      console.log(`[NotificationService] Creating incoming call notification from ${callerName} (Call ID: ${callId}) in Chat ${chatId}`);
      const members = await prisma.chatMember.findMany({
        where: { chatId, userId: { not: callerId } },
        select: { userId: true },
      });

      for (const member of members) {
        console.log(`[NotificationService] Dispatching incoming call notification to user ${member.userId}`);
        await this.sendToUser(member.userId, {
          title: callerName,
          body: callType === 'VIDEO' ? '📹 Incoming video call...' : '📞 Incoming voice call...',
          imageUrl: callerAvatar || undefined,
        }, {
          type: 'incoming_call',
          callId,
          chatId,
          callerId,
          callerName,
          callType,
          roomName,
          avatar: callerAvatar || '',
        }, 'calls');
      }
    } catch (err: any) {
      console.error('[NotificationService] sendIncomingCallNotification error:', err.message);
    }
  }

  /**
   * Send call cancelled push notification (dismisses incoming call ring UI on all recipient devices)
   */
  static async sendCallCancelledNotification(chatId: string, callId: string, callerId: string) {
    try {
      console.log(`[NotificationService] Creating call cancelled notification for Call ID: ${callId}`);
      const members = await prisma.chatMember.findMany({
        where: { chatId, userId: { not: callerId } },
        select: { userId: true },
      });

      for (const member of members) {
        console.log(`[NotificationService] Dispatching call cancellation to user ${member.userId}`);
        await this.sendToUser(member.userId, undefined, {
          type: 'call_cancelled',
          callId,
          chatId,
        }, 'calls');
      }
    } catch (err: any) {
      console.error('[NotificationService] sendCallCancelledNotification error:', err.message);
    }
  }

  /**
   * Send missed call notification
   */
  static async sendMissedCallNotification(
    chatId: string,
    callId: string,
    recipientId: string,
    callerName: string,
  ) {
    try {
      console.log(`[NotificationService] Creating missed call notification for user ${recipientId} from ${callerName}`);
      await this.sendToUser(recipientId, {
        title: 'Missed Call',
        body: `Missed call from ${callerName}`,
      }, {
        type: 'missed_call',
        callId,
        chatId,
        callerName,
      }, 'missed_calls');
    } catch (err: any) {
      console.error('[NotificationService] sendMissedCallNotification error:', err.message);
    }
  }

  /**
   * Core method: Dispatch FCM notification to all active devices of a target user
   */
  private static async sendToUser(
    userId: string,
    notification: { title: string; body: string; imageUrl?: string } | undefined,
    data: Record<string, string>,
    channelId: string,
  ) {
    if (!firebaseInitialized) {
      console.warn('[NotificationService] Skip sending: Firebase Admin SDK is not initialized.');
      return;
    }

    const tokens = await prisma.pushToken.findMany({
      where: { userId, isValid: true },
      select: { id: true, token: true, platform: true },
    });

    if (tokens.length === 0) {
      console.log(`[NotificationService] User ${userId} has 0 registered push tokens. Skipping dispatch.`);
      return;
    }

    console.log(`[NotificationService] Sending notification to User ${userId} on ${tokens.length} devices.`);
    const invalidTokenIds: string[] = [];

    for (const { id, token, platform } of tokens) {
      try {
        const isCallChannel = channelId === 'calls';

        const messagePayload: Message = {
          token,
          data: {
            ...data,
            channelId,
            // Include notification display info in data so native handler can show it
            ...(notification ? {
              notifTitle: notification.title,
              notifBody: notification.body,
              ...(notification.imageUrl ? { notifImage: notification.imageUrl } : {}),
            } : {}),
          },
          android: {
            priority: 'high', // Always high priority for reliable background/killed delivery
            ttl: isCallChannel ? 30000 : 3600000, // 30 seconds for calls, 1 hour for messages
            // Data-only message for Android — native USChatMessagingService handles display
            // This prevents FCM SDK from auto-showing a duplicate notification
          },
          apns: {
            headers: {
              'apns-priority': isCallChannel ? '10' : '5',
              'apns-expiration': isCallChannel ? '30' : '3600',
            },
            payload: {
              aps: {
                sound: isCallChannel ? 'ringtone.caf' : 'default',
                badge: data.badgeCount ? parseInt(data.badgeCount, 10) : undefined,
                contentAvailable: true,
              },
            },
          },
        };

        // Only add top-level notification block for iOS (apns handles it)
        // Android uses data-only to let onMessageReceived() handle display
        if (notification && platform !== 'android') {
          messagePayload.notification = {
            title: notification.title,
            body: notification.body,
            ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
          };
        }

        console.log(`[NotificationService] FCM Request details for token ID ${id}:`, JSON.stringify(messagePayload, null, 2));
        const fcmResponse = await getMessaging().send(messagePayload);
        console.log(`[NotificationService] FCM Response for token ID ${id}: Success! ID = ${fcmResponse}`);
      } catch (err: any) {
        console.error(`[NotificationService] FCM send failed for token ID ${id} (User: ${userId}). Error:`, err);
        if (
          err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokenIds.push(id);
        }
      }
    }

    // Clean up invalid/expired tokens directly by deleting them
    if (invalidTokenIds.length > 0) {
      try {
        await prisma.pushToken.deleteMany({
          where: { id: { in: invalidTokenIds } },
        });
        console.log(`[NotificationService] Successfully deleted ${invalidTokenIds.length} invalid tokens from DB`);
      } catch (cleanupErr: any) {
        console.error(`[NotificationService] Failed to clean up invalid tokens:`, cleanupErr.message);
      }
    }
  }
}
