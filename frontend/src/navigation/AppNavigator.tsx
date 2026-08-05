import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { ChatScreen } from '../screens/Chat/ChatScreen';
import { CreateChatScreen } from '../screens/Chat/CreateChatScreen';
import { CallScreen } from '../screens/Call/CallScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { useCallStore } from '../store/callStore';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, View, Alert } from 'react-native';
import { COLORS } from '../theme/colors';
import { apiClient } from '../api/client';

const Stack = createNativeStackNavigator();

const CallBridge = () => {
  const navigation = useNavigation<any>();
  const startCall = useCallStore((s) => s.startCall);

  const handleAccept = async (incomingCall: any) => {
    try {
      const callId = incomingCall?.callId || incomingCall?.id;
      const res = await apiClient.post(`/calls/${callId}/join`);

      startCall({
        callId,
        chatId: incomingCall?.chatId,
        roomName: res.data.call?.roomName || incomingCall?.roomName,
        livekitToken: res.data.livekitToken,
        wsUrl: res.data.wsUrl,
        type: 'AUDIO',
        isMuted: false,
        isConnected: true, // callee is immediately connected
        peerName: incomingCall?.initiatorName || 'Caller',
      });
      navigation.navigate('CallScreen');
    } catch (err: any) {
      console.error('Join call error:', err);
      Alert.alert('Call Failed', err.response?.data?.message || 'Unable to join call');
    }
  };

  return <IncomingCallModal onAccept={handleAccept} />;
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
            <Stack.Screen name="CallScreen" component={CallScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
      {isAuthenticated && <CallBridge />}
    </>
  );
};
