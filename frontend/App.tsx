import 'fast-text-encoding';

if (typeof global.TextEncoder === 'undefined') {
  const textEncoding = require('fast-text-encoding');
  global.TextEncoder = textEncoding.TextEncoder;
  global.TextDecoder = textEncoding.TextDecoder;
}

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, PermissionsAndroid } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useChatStore } from './src/store/chatStore';
import { useThemeStore } from './src/store/themeStore';

async function requestNotificationPermission() {
  if (Platform.OS !== 'android') return;

  // Silent native notification permission request (no intrusive dialog alerts)
  if (Platform.Version >= 33) {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    } catch (err) {
      console.warn('Notification permission request error:', err);
    }
  }
}

export default function App() {
  const initWsListeners = useChatStore((s) => s.initWsListeners);
  const { isDarkMode, loadTheme } = useThemeStore();

  React.useEffect(() => {
    loadTheme();
    initWsListeners();
    requestNotificationPermission();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <AppNavigator key={isDarkMode ? 'dark' : 'light'} />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
