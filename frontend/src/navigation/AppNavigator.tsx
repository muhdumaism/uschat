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
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, View, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { COLORS } from '../theme/colors';

const Stack = createNativeStackNavigator();

const OpenChatBridge = () => {
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (Platform.OS !== 'android' || !NativeModules.USChatModule) return;

    const { USChatModule } = NativeModules;
    const eventEmitter = new NativeEventEmitter(USChatModule);

    const handleOpenChatAction = (chatId: string) => {
      console.log('[AppNavigator] Received native open chat action:', chatId);
      if (chatId) {
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

export const AppNavigator = () => {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
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
          </>
        )}
      </Stack.Navigator>
      {isAuthenticated && <OpenChatBridge />}
    </>
  );
};
