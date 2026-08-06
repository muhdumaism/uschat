import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  PermissionsAndroid,
  Alert,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { Phone, PhoneOff, Video } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { COLORS } from '../theme/colors';
import { useCallStore } from '../store/callStore';
import { SoundService } from '../services/soundService';
import { apiClient } from '../api/client';

export const requestCallPermissions = async (isVideo: boolean = false): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (isVideo) {
    permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  }

  const recorded = await PermissionsAndroid.requestMultiple(permissions);
  const micGranted = recorded[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (micGranted !== PermissionsAndroid.RESULTS.GRANTED && micGranted !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    Alert.alert('Permission Required', 'Microphone permission is required to accept calls.');
    return false;
  }

  return true;
};

interface IncomingCallModalProps {
  onAccept: (call: any) => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ onAccept }) => {
  const { incomingCall, endCall, setIncomingCall } = useCallStore();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (incomingCall) {
      // Play call ringtone audio & continuous vibration pattern
      SoundService.playRingtone(true);

      // Start pulsing avatar ring animation
      Animated.loop(
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      SoundService.stop();
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.3);
    }

    return () => {
      SoundService.stop();
    };
  }, [incomingCall]);

  if (!incomingCall) return null;

  const isVideo = incomingCall?.type === 'VIDEO';

  const handleAccept = async () => {
    const granted = await requestCallPermissions(isVideo);
    if (!granted) return;
    await SoundService.stop();
    const callToAccept = incomingCall;
    setIncomingCall(null);
    onAccept(callToAccept);
  };

  const handleDecline = async () => {
    await SoundService.stop();
    try {
      if (incomingCall) {
        const callId = incomingCall.callId || incomingCall.id;
        await apiClient.post(`/calls/${callId}/decline`);
      }
    } catch (err) {
      console.error('Decline call API error:', err);
    }
    endCall();
  };

  return (
    <Modal visible={!!incomingCall} transparent={false} animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <View style={styles.container}>

        {/* Pulsing Avatar Rings (WhatsApp / Instagram style) */}
        <View style={styles.avatarContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: opacityAnim,
              },
            ]}
          />
          <Avatar
            name={incomingCall?.initiatorName || 'Caller'}
            uri={incomingCall?.callerAvatar}
            size={110}
          />
        </View>

        {/* Caller Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.callerName} numberOfLines={1}>
            {incomingCall?.initiatorName || 'USCHAT User'}
          </Text>
          <View style={styles.callTypeBadge}>
            {isVideo ? (
              <Video size={16} color={COLORS.accent} style={styles.typeIcon} />
            ) : (
              <Phone size={16} color={COLORS.accent} style={styles.typeIcon} />
            )}
            <Text style={styles.callTypeLabel}>
              {isVideo ? 'Incoming Video Call...' : 'Incoming Voice Call...'}
            </Text>
          </View>
          <Text style={styles.encryptionNotice}>🔒 USCHAT End-to-End Encrypted</Text>
        </View>

        {/* Accept / Decline Action Buttons */}
        <View style={styles.actionRow}>
          <View style={styles.actionColumn}>
            <TouchableOpacity
              onPress={handleDecline}
              style={[styles.button, styles.declineButton]}
              activeOpacity={0.8}
            >
              <PhoneOff size={32} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.buttonLabel}>Decline</Text>
          </View>

          <View style={styles.actionColumn}>
            <TouchableOpacity
              onPress={handleAccept}
              style={[styles.button, styles.acceptButton]}
              activeOpacity={0.8}
            >
              {isVideo ? <Video size={32} color="#FFF" /> : <Phone size={32} color="#FFF" />}
            </TouchableOpacity>
            <Text style={styles.buttonLabel}>Accept</Text>
          </View>
        </View>

      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 70,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: COLORS.accent,
  },
  infoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  callerName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  typeIcon: {
    marginRight: 8,
  },
  callTypeLabel: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  encryptionNotice: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    opacity: 0.9,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  actionColumn: {
    alignItems: 'center',
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  declineButton: {
    backgroundColor: COLORS.danger,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
});
