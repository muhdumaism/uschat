import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { apiClient } from '../api/client';
import { WebSocketClient } from '../api/wsClient';
import { WS_URL, API_BASE_URL } from '../api/config';
import { NativeNotificationService } from '../services/notificationService';

const { USChatModule } = NativeModules;

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  role: string;
  disappearingDefault?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateUser: (fields: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, token, refreshToken) => {
    await AsyncStorage.setItem('@uschat/token', token);
    await AsyncStorage.setItem('@uschat/refreshToken', refreshToken);
    await AsyncStorage.setItem('@uschat/user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
    WebSocketClient.connect();

    if (Platform.OS === 'android' && USChatModule) {
      try {
        USChatModule.setAuthToken(token, API_BASE_URL);
        const fcmToken = await USChatModule.getFcmToken();
        if (fcmToken) {
          await NativeNotificationService.registerFcmTokenWithBackend(fcmToken);
        }
      } catch (err) {
        console.warn('FCM token registration failed on login:', err);
      }
    }
  },

  logout: async () => {
    if (Platform.OS === 'android' && USChatModule) {
      try {
        const fcmToken = await USChatModule.getFcmToken();
        if (fcmToken) {
          await NativeNotificationService.unregisterFcmToken(fcmToken);
        }
        USChatModule.clearAuthToken();
      } catch (err) {
        console.warn('FCM token unregistration failed on logout:', err);
      }
    }

    await AsyncStorage.removeItem('@uschat/token');
    await AsyncStorage.removeItem('@uschat/refreshToken');
    await AsyncStorage.removeItem('@uschat/user');
    WebSocketClient.disconnect();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  loadSession: async () => {
    try {
      const token = await AsyncStorage.getItem('@uschat/token');
      const userRaw = await AsyncStorage.getItem('@uschat/user');
      if (token && userRaw) {
        const user = JSON.parse(userRaw);
        set({ user, token, isAuthenticated: true, isLoading: false });
        WebSocketClient.connect();

        if (Platform.OS === 'android' && USChatModule) {
          try {
            USChatModule.setAuthToken(token, API_BASE_URL);
            const fcmToken = await USChatModule.getFcmToken();
            if (fcmToken) {
              await NativeNotificationService.registerFcmTokenWithBackend(fcmToken);
            }
          } catch (err) {
            console.warn('FCM token registration failed on session load:', err);
          }
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateUser: (fields) => {
    set((state) => {
      const updatedUser = state.user ? { ...state.user, ...fields } : null;
      if (updatedUser) {
        AsyncStorage.setItem('@uschat/user', JSON.stringify(updatedUser)).catch((err) =>
          console.error('Failed to persist updated user:', err)
        );
      }
      return { user: updatedUser };
    });
  },
}));
