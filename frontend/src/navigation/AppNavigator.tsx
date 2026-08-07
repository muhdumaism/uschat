import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { ChatScreen } from '../screens/Chat/ChatScreen';
import { CreateChatScreen } from '../screens/Chat/CreateChatScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { MessageRequestsScreen } from '../screens/Chat/MessageRequestsScreen';
import { MusicScreen } from '../screens/Music/MusicScreen';
import { GroupSettingsScreen } from '../screens/Chat/GroupSettingsScreen';
import { CallScreen } from '../screens/Call/CallScreen';
import { useCallStore } from '../store/callStore';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, View, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { COLORS } from '../theme/colors';
import { RETRO_COLORS } from '../theme/retroTheme';

const Stack = createNativeStackNavigator();

const OpenChatBridge = () => {
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (Platform.OS !== 'android' || !NativeModules.USChatModule) return;

    const { USChatModule } = NativeModules;
    const eventEmitter = new NativeEventEmitter(USChatModule);

    const handleOpenChatAction = (data: any) => {
      console.log('[AppNavigator] Received native open chat action raw:', data);
      const chatId = typeof data === 'object' && data !== null ? data.chatId : data;
      if (chatId && typeof chatId === 'string') {
        try {
          USChatModule.clearChatNotifications(chatId);
        } catch (err) {}
        navigation.navigate('Chat', { chatId, name: 'Chat' });
      }
    };

    // 1. Process initial actions (cold-start)
    USChatModule.getInitialOpenChatAction().then((chatId: string | null) => {
      if (chatId) {
        handleOpenChatAction(chatId);
      }
    });

    // 2. Add event listeners for warm-starts
    const chatSub = eventEmitter.addListener('onOpenChat', handleOpenChatAction);

    return () => {
      chatSub.remove();
    };
  }, []);

  return null;
};

const CallBridge = () => {
  const navigation = useNavigation<any>();
  const callStatus = useCallStore((s) => s.status);

  useEffect(() => {
    if (callStatus !== 'idle') {
      navigation.navigate('Call');
    }
  }, [callStatus]);

  return null;
};

export const AppNavigator = () => {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: RETRO_COLORS.desktop, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={RETRO_COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: RETRO_COLORS.desktop } }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="CreateChat" component={CreateChatScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="MessageRequests" component={MessageRequestsScreen} />
            <Stack.Screen name="Music" component={MusicScreen} />
            <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
            <Stack.Screen name="Call" component={CallScreen} options={{ gestureEnabled: false }} />
          </>
        )}
      </Stack.Navigator>
      {isAuthenticated && <OpenChatBridge />}
      {isAuthenticated && <CallBridge />}
    </>
  );
};
