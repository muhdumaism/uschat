import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { API_BASE_URL } from '../api/config';

export interface PushNotificationPayload {
  type: 'message' | 'incoming_call' | 'call_cancelled' | 'missed_call';
  chatId?: string;
  senderId?: string;
  senderName?: string;
  messageType?: string;
  callId?: string;
  callerId?: string;
  callerName?: string;
  callType?: string;
  roomName?: string;
  badgeCount?: string;
}

export const NativeNotificationService = {

  /**
   * Register device FCM push token with backend engine
   */
  registerFcmTokenWithBackend: async (fcmToken: string) => {
    try {
      const userToken = await AsyncStorage.getItem('user_token');
      if (!userToken) return;

      await axios.post(
        `${API_BASE_URL}/notifications/register-token`,
        {
          token: fcmToken,
          platform: Platform.OS,
          deviceId: `${Platform.OS}-${Platform.Version}`,
        },
        {
          headers: { Authorization: `Bearer ${userToken}` },
        }
      );
      console.log('[NativeNotificationService] FCM token registered with backend successfully');
    } catch (err: any) {
      console.warn('[NativeNotificationService] Failed to register FCM token with backend:', err.message);
    }
  },

  /**
   * Unregister FCM token on logout
   */
  unregisterFcmToken: async (fcmToken: string) => {
    try {
      const userToken = await AsyncStorage.getItem('user_token');
      if (!userToken) return;

      await axios.post(
        `${API_BASE_URL}/notifications/unregister-token`,
        { token: fcmToken },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
    } catch (err: any) {
      console.warn('[NativeNotificationService] Failed to unregister FCM token:', err.message);
    }
  },

  /**
   * Parse incoming notification payload and return deep-link navigation parameters
   */
  parseNotificationNavigation: (data: Record<string, any>) => {
    if (!data || !data.type) return null;

    switch (data.type) {
      case 'message':
        return { screen: 'ChatScreen', params: { chatId: data.chatId } };
      case 'incoming_call':
        return {
          screen: 'CallScreen',
          params: {
            callId: data.callId,
            chatId: data.chatId,
            roomName: data.roomName,
            type: data.callType || 'AUDIO',
          },
        };
      case 'missed_call':
        return { screen: 'ChatScreen', params: { chatId: data.chatId } };
      default:
        return null;
    }
  },
};
