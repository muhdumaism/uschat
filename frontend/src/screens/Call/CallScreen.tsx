import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, Alert } from 'react-native';
import { Mic, MicOff, PhoneOff, ShieldCheck, Volume2 } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { useCallStore } from '../../store/callStore';
import { SoundService } from '../../services/soundService';
import { apiClient } from '../../api/client';

export const CallScreen: React.FC<any> = ({ navigation }) => {
  const { activeCall, toggleMute, endCall } = useCallStore();
  const [duration, setDuration] = useState(0);
  const isConnected = activeCall?.isConnected || false;
  const roomRef = useRef<any>(null);

  // Play outgoing ringback tone when screen mounts
  useEffect(() => {
    if (!isConnected) {
      SoundService.playRingtone(false);
    }
    return () => {
      SoundService.stop();
    };
  }, []);

  // Stop ringing when call connects
  useEffect(() => {
    if (isConnected) {
      SoundService.stop();
    }
  }, [isConnected]);

  // Connect to LiveKit room when we have a token and the call is connected
  useEffect(() => {
    let room: any = null;

    const connectToRoom = async () => {
      try {
        const { Room, RoomEvent, AudioSession } = require('@livekit/react-native');
        room = new Room({
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          console.log('LiveKit: Disconnected from room');
          try {
            AudioSession.stop();
          } catch {}
        });

        room.on(RoomEvent.TrackSubscribed, (track: any) => {
          console.log('LiveKit: Track subscribed', track.kind);
        });

        // Start WebRTC audio session configuration
        await AudioSession.start();

        await room.connect(activeCall!.wsUrl, activeCall!.livekitToken, {
          autoSubscribe: true,
        });

        // Publish microphone audio
        await room.localParticipant.setMicrophoneEnabled(true);
        console.log('LiveKit: Connected and publishing audio');
      } catch (err) {
        console.error('LiveKit connection error:', err);
      }
    };

    if (isConnected && activeCall?.livekitToken) {
      connectToRoom();
    }

    return () => {
      if (room) {
        try {
          room.disconnect();
          const { AudioSession } = require('@livekit/react-native');
          AudioSession.stop();
        } catch {}
      }
    };
  }, [isConnected]);

  // Call duration timer — only counts when connected
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  if (!activeCall) {
    navigation.goBack();
    return null;
  }

  const handleEndCall = async () => {
    try {
      // Disconnect from LiveKit room
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      // Tell the backend to end the call
      await apiClient.post(`/calls/${activeCall.callId}/end`);
    } catch (err) {
      console.error('End call error:', err);
    }
    endCall();
    SoundService.stop();
    navigation.goBack();
  };

  const handleToggleMute = () => {
    toggleMute();
    // Also toggle mic on LiveKit room
    if (roomRef.current?.localParticipant) {
      try {
        roomRef.current.localParticipant.setMicrophoneEnabled(activeCall.isMuted);
      } catch {}
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const peerName = activeCall.peerName || (activeCall.roomName.includes('_') ? activeCall.roomName.split('_')[2] : 'Peer');
  const peerInitials = peerName.substring(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.e2eeBadge}>
          <ShieldCheck size={14} color={COLORS.success} />
          <Text style={styles.e2eeText}>End-to-End Encrypted</Text>
        </View>
        <Text style={styles.roomName}>Voice Call</Text>
      </View>

      <View style={styles.centerArea}>
        {/* Pulsing ring animation effect when ringing */}
        {!isConnected && (
          <View style={styles.pulseRing} />
        )}
        <View style={[styles.avatarCircle, isConnected && styles.avatarConnected]}>
          <Text style={styles.avatarText}>{peerInitials}</Text>
        </View>
        <Text style={styles.participantName}>{peerName}</Text>
        <Text style={[styles.callStatus, isConnected && styles.callStatusConnected]}>
          {isConnected ? formatDuration(duration) : 'Ringing...'}
        </Text>
        {isConnected && (
          <View style={styles.liveBadge}>
            <Volume2 size={12} color={COLORS.success} />
            <Text style={styles.liveText}>LIVE AUDIO</Text>
          </View>
        )}
      </View>

      <View style={styles.controlBar}>
        <TouchableOpacity
          onPress={handleToggleMute}
          style={[styles.controlBtn, activeCall.isMuted && styles.activeBtn]}
        >
          {activeCall.isMuted ? (
            <MicOff size={22} color="#FFF" />
          ) : (
            <Mic size={22} color={COLORS.textPrimary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleEndCall} style={styles.hangupBtn}>
          <PhoneOff size={26} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070D',
    justifyContent: 'space-between',
  },
  topBar: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  e2eeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: COLORS.success,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
  },
  e2eeText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  roomName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.secondaryBackground,
    borderColor: COLORS.primary,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarConnected: {
    borderColor: COLORS.success,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  avatarText: {
    color: COLORS.accent,
    fontSize: 36,
    fontWeight: '800',
  },
  participantName: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  callStatus: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  callStatusConnected: {
    color: COLORS.success,
    fontSize: 22,
    fontWeight: '800',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
  },
  liveText: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
    letterSpacing: 1,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 60,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBtn: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  hangupBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
});
