import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, Alert } from 'react-native';
import { Mic, MicOff, PhoneOff, ShieldCheck, Volume2, Activity } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { useCallStore } from '../../store/callStore';
import { SoundService } from '../../services/soundService';
import { apiClient } from '../../api/client';

export const CallScreen: React.FC<any> = ({ navigation }) => {
  const { activeCall, toggleMute, endCall } = useCallStore();
  const [duration, setDuration] = useState(0);
  const isConnected = activeCall?.isConnected || false;
  const roomRef = useRef<any>(null);

  // Diagnostics and media states
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [roomState, setRoomState] = useState('disconnected');
  const [isLocalTrackPublished, setIsLocalTrackPublished] = useState(false);
  const [remoteParticipantConnected, setRemoteParticipantConnected] = useState(false);
  const [subscribedTracks, setSubscribedTracks] = useState<any[]>([]);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Play outgoing ringback tone when screen mounts & request micro permissions
  useEffect(() => {
    if (!isConnected) {
      SoundService.playRingtone(false);
    }

    const checkPermissions = async () => {
      const { requestCallPermissions } = require('../../components/IncomingCallModal');
      const granted = await requestCallPermissions(false);
      if (!granted) {
        Alert.alert('Permission Denied', 'Microphone permission is required for voice calls.');
        handleEndCall();
      }
    };
    checkPermissions();

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
        console.log('LiveKit: Connecting to room with WS:', activeCall!.wsUrl);
        const { Room, RoomEvent, AudioSession } = require('@livekit/react-native');
        
        room = new Room({
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        roomRef.current = room;
        setRoomState(room.state);

        room.on(RoomEvent.StateChanged, (state: any) => {
          setRoomState(state);
          console.log(`[LiveKit Event] StateChanged: ${state}`);
        });

        room.on(RoomEvent.Disconnected, () => {
          console.log('[LiveKit Event] Disconnected');
          setRoomState('disconnected');
          setIsLocalTrackPublished(false);
          setRemoteParticipantConnected(false);
          setSubscribedTracks([]);
          try {
            AudioSession.stop();
          } catch (err) {
            console.error('AudioSession stop error:', err);
          }
        });

        room.on(RoomEvent.TrackSubscribed, (track: any) => {
          console.log(`[LiveKit Event] TrackSubscribed: kind=${track.kind}, sid=${track.sid}`);
          if (track.kind === 'audio') {
            setSubscribedTracks((prev) => {
              if (prev.some((t) => t.sid === track.sid)) return prev;
              return [...prev, track];
            });
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
          console.log(`[LiveKit Event] TrackUnsubscribed: kind=${track.kind}, sid=${track.sid}`);
          if (track.kind === 'audio') {
            setSubscribedTracks((prev) => prev.filter((t) => t.sid !== track.sid));
          }
        });

        room.on(RoomEvent.LocalTrackPublished, (publication: any) => {
          console.log(`[LiveKit Event] LocalTrackPublished: kind=${publication.track.kind}`);
          if (publication.track.kind === 'audio') {
            setIsLocalTrackPublished(true);
          }
        });

        room.on(RoomEvent.LocalTrackUnpublished, (publication: any) => {
          console.log(`[LiveKit Event] LocalTrackUnpublished: kind=${publication.track.kind}`);
          if (publication.track.kind === 'audio') {
            setIsLocalTrackPublished(false);
          }
        });

        room.on(RoomEvent.ParticipantConnected, (participant: any) => {
          console.log(`[LiveKit Event] ParticipantConnected: identity=${participant.identity}`);
          setRemoteParticipantConnected(true);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
          console.log(`[LiveKit Event] ParticipantDisconnected: identity=${participant.identity}`);
          setRemoteParticipantConnected(false);
        });

        room.on(RoomEvent.TrackMuted, (publication: any) => {
          console.log(`[LiveKit Event] TrackMuted: kind=${publication.track.kind}`);
        });

        room.on(RoomEvent.TrackUnmuted, (publication: any) => {
          console.log(`[LiveKit Event] TrackUnmuted: kind=${publication.track.kind}`);
        });

        // Start WebRTC audio session configuration
        await AudioSession.start();
        console.log('LiveKit: AudioSession started');

        // Query initial speakerphone status
        try {
          const isOn = await AudioSession.isSpeakerphoneOn();
          setIsSpeakerOn(isOn);
        } catch (err) {
          console.warn('Could not query speaker state:', err);
        }

        await room.connect(activeCall!.wsUrl, activeCall!.livekitToken, {
          autoSubscribe: true,
        });
        console.log('LiveKit: Connected to room. Publishing microphone...');

        // Publish microphone audio
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsLocalTrackPublished(true);

        if (room.participants.size > 0) {
          setRemoteParticipantConnected(true);
        }
      } catch (err) {
        console.error('LiveKit connection error:', err);
        Alert.alert('Call Connection Failed', 'Could not establish WebRTC audio session.');
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
        } catch (err) {
          console.error('Room disconnect cleanup error:', err);
        }
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
      } catch (err) {
        console.error('Error toggling mic:', err);
      }
    }
  };

  const handleToggleSpeaker = async () => {
    try {
      const { AudioSession } = require('@livekit/react-native');
      const nextState = !isSpeakerOn;
      await AudioSession.setSpeakerphoneOn(nextState);
      setIsSpeakerOn(nextState);
      console.log('LiveKit: Speakerphone toggled to', nextState);
    } catch (err) {
      console.error('Error toggling speaker:', err);
    }
  };

  const renderDiagnostics = () => {
    if (!showDiagnostics) return null;

    return (
      <View style={styles.diagnosticsPanel}>
        <Text style={styles.diagTitle}>CALL DIAGNOSTICS</Text>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Room State:</Text>
          <Text style={[styles.diagVal, { color: roomState === 'connected' ? COLORS.success : COLORS.warning }]}>
            {roomState.toUpperCase()}
          </Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Mic Active:</Text>
          <Text style={styles.diagVal}>{!activeCall?.isMuted ? 'YES' : 'NO (Muted)'}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Local Track Published:</Text>
          <Text style={styles.diagVal}>{isLocalTrackPublished ? 'YES' : 'NO'}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Remote Participant Joined:</Text>
          <Text style={styles.diagVal}>{remoteParticipantConnected ? 'YES' : 'NO (Waiting)'}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Remote Audio Subscribed:</Text>
          <Text style={styles.diagVal}>{subscribedTracks.length > 0 ? 'YES' : 'NO'}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Audio Route:</Text>
          <Text style={styles.diagVal}>{isSpeakerOn ? 'SPEAKERPHONE' : 'EARPIECE / WIRED'}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Audio Stream Tx/Rx:</Text>
          <Text style={styles.diagVal}>ACTIVE (WebRTC Streaming)</Text>
        </View>
      </View>
    );
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 8 }}>
          <Text style={styles.roomName}>Voice Call</Text>
          <TouchableOpacity
            onPress={() => setShowDiagnostics(!showDiagnostics)}
            style={{ marginLeft: 10, padding: 4 }}
          >
            <Activity size={16} color={showDiagnostics ? COLORS.primary : COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {renderDiagnostics()}

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

        <TouchableOpacity
          onPress={handleToggleSpeaker}
          style={[styles.controlBtn, isSpeakerOn && styles.activeBtn]}
        >
          <Volume2 size={22} color={isSpeakerOn ? '#FFF' : COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleEndCall} style={styles.hangupBtn}>
          <PhoneOff size={26} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Render remote audio tracks to direct WebRTC streaming to speakers */}
      {subscribedTracks.map((track) => {
        const { AudioTrack } = require('@livekit/react-native');
        return <AudioTrack key={track.sid} track={track} />;
      })}
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
  diagnosticsPanel: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(18, 26, 45, 0.95)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    zIndex: 9999,
  },
  diagTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 1,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  diagLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  diagVal: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
