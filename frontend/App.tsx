import 'fast-text-encoding';

if (typeof global.TextEncoder === 'undefined') {
  const textEncoding = require('fast-text-encoding');
  global.TextEncoder = textEncoding.TextEncoder;
  global.TextDecoder = textEncoding.TextDecoder;
}

import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, PermissionsAndroid, View, DeviceEventEmitter } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useChatStore } from './src/store/chatStore';
import { useThemeStore } from './src/store/themeStore';
import { useMusicStore } from './src/store/musicStore';

const navigationRef = createNavigationContainerRef();

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
  const initStore = useMusicStore((s) => s.initStore);
  const fetchLikedSongs = useMusicStore((s) => s.fetchLikedSongs);

  React.useEffect(() => {
    loadTheme();
    initWsListeners();
    requestNotificationPermission();
    
    // Initialize persistent music state and liked songs list on launch
    initStore();
    fetchLikedSongs();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={() => {
          const currentRoute = navigationRef.getCurrentRoute();
          if (currentRoute) {
            DeviceEventEmitter.emit('onNavigationStateChange', currentRoute.name);
          }
        }}
      >
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={{ flex: 1 }}>
          <AppNavigator key={isDarkMode ? 'dark' : 'light'} />
        </View>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
