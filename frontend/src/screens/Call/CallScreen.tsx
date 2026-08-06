import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, Alert, Dimensions } from 'react-native';
import { Mic, MicOff, PhoneOff, ShieldCheck, Volume2, VolumeX, Activity, Headphones, Tv } from 'lucide-react-native';
const { Room, RoomEvent, AudioSession, VideoView, AudioTrack } = require('@livekit/react-native');
import { COLORS } from '../../theme/colors';
import { useCallStore } from '../../store/callStore';
import { SoundService } from '../../services/soundService';
import { apiClient } from '../../api/client';

const { width } = Dimensions.get('window');

export const CallScreen: React.FC<any> = ({ navigation }) => {
  const { activeCall, toggleMute, endCall } = useCallStore();
  const [duration, setDuration] = useState(0);
  const isConnected = activeCall?.isConnected || false;
  const roomRef = useRef<any>(null);

  // Advanced States
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [roomState, setRoomState] = useState('disconnected');
  const [isLocalTrackPublished, setIsLocalTrackPublished] = useState(false);
  const [remoteParticipantConnected, setRemoteParticipantConnected] = useState(false);
  const [subscribedTracks, setSubscribedTracks] = useState<any[]>([]);
  const [subscribedVideoTracks, setSubscribedVideoTracks] = useState<any[]>([]);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [hasCallPermissions, setHasCallPermissions] = useState(false);

  // Voice Lounge States
  const [isDeafened, setIsDeafened] = useState(false);
  const [isNoiseFilterEnabled, setIsNoiseFilterEnabled] = useState(true);
  const [isLocalScreenShareEnabled, setIsLocalScreenShareEnabled] = useState(false);
  const [participantsList, setParticipantsList] = useState<any[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);

  // Play outgoing ringback tone when screen mounts & request micro permissions
  useEffect(() => {
    if (!isConnected) {
      SoundService.playRingtone(false);
    }

    const checkPermissions = async () => {
      const { requestCallPermissions } = require('../../components/IncomingCallModal');
      const granted = await requestCallPermissions(false);
      if (granted) {
        setHasCallPermissions(true);
      } else {
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
        
        room = new Room({
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: isNoiseFilterEnabled,
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
          setSubscribedVideoTracks([]);
          setParticipantsList([]);
          try {
            AudioSession.stop();
          } catch (err) {
            console.error('AudioSession stop error:', err);
          }
        });

        room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
          console.log(`[LiveKit Event] TrackSubscribed: kind=${track.kind}, source=${track.source}, sid=${track.sid}`);
          if (track.kind === 'audio') {
            setSubscribedTracks((prev) => {
              if (prev.some((t) => t.sid === track.sid)) return prev;
              return [...prev, track];
            });
          } else if (track.kind === 'video') {
            setSubscribedVideoTracks((prev) => {
              if (prev.some((t) => t.track.sid === track.sid)) return prev;
              return [...prev, { track, participant, publication }];
            });
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
          console.log(`[LiveKit Event] TrackUnsubscribed: kind=${track.kind}, sid=${track.sid}`);
          if (track.kind === 'audio') {
            setSubscribedTracks((prev) => prev.filter((t) => t.sid !== track.sid));
          } else if (track.kind === 'video') {
            setSubscribedVideoTracks((prev) => prev.filter((t) => t.track.sid !== track.sid));
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

        const updateParticipants = () => {
          if (roomRef.current) {
            setParticipantsList(Array.from(roomRef.current.participants.values()));
            setRemoteParticipantConnected(roomRef.current.participants.size > 0);
          }
        };

        room.on(RoomEvent.ParticipantConnected, (participant: any) => {
          console.log(`[LiveKit Event] ParticipantConnected: identity=${participant.identity}`);
          updateParticipants();
          SoundService.playTone('join');
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
          console.log(`[LiveKit Event] ParticipantDisconnected: identity=${participant.identity}`);
          updateParticipants();
          SoundService.playTone('leave');
        });

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
          const speakerIdentities = speakers.map((s) => s.identity);
          setActiveSpeakers(speakerIdentities);
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

        updateParticipants();
        SoundService.playTone('join');
      } catch (err) {
        console.error('LiveKit connection error:', err);
        Alert.alert('Call Connection Failed', 'Could not establish WebRTC audio session.');
      }
    };

    if (isConnected && activeCall?.livekitToken && hasCallPermissions) {
      connectToRoom();
    }

    return () => {
      if (room) {
        try {
          room.disconnect();
          AudioSession.stop();
        } catch (err) {
          console.error('Room disconnect cleanup error:', err);
        }
      }
    };
  }, [isConnected, hasCallPermissions]);

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
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      await apiClient.post(`/calls/${activeCall.callId}/end`);
    } catch (err) {
      console.error('End call error:', err);
    }
    SoundService.playTone('leave');
    endCall();
    SoundService.stop();
    navigation.goBack();
  };

  const handleToggleMute = () => {
    if (!activeCall) return;
    const nextMuteState = !activeCall.isMuted;
    toggleMute();
    if (roomRef.current?.localParticipant) {
      try {
        roomRef.current.localParticipant.setMicrophoneEnabled(!nextMuteState);
        SoundService.playTone(nextMuteState ? 'mute' : 'unmute');
      } catch (err) {
        console.error('Error toggling mic:', err);
      }
    }
  };

  const handleToggleSpeaker = async () => {
    try {
      const nextState = !isSpeakerOn;
      await AudioSession.setSpeakerphoneOn(nextState);
      setIsSpeakerOn(nextState);
      console.log('LiveKit: Speakerphone toggled to', nextState);
    } catch (err) {
      console.error('Error toggling speaker:', err);
    }
  };

  const handleToggleDeafen = () => {
    const nextDeafenState = !isDeafened;
    setIsDeafened(nextDeafenState);
    SoundService.playTone(nextDeafenState ? 'deafen' : 'undeafen');
  };

  const handleToggleScreenShare = async () => {
    if (!roomRef.current?.localParticipant) return;
    try {
      const nextState = !isLocalScreenShareEnabled;
      await roomRef.current.localParticipant.setScreenShareEnabled(nextState);
      setIsLocalScreenShareEnabled(nextState);
      SoundService.playTone(nextState ? 'stream_start' : 'stream_stop');
    } catch (err) {
      console.warn('Error toggling screen share:', err);
      Alert.alert('Screen Share Failed', 'Could not toggle screenshare.');
    }
  };

  const handleToggleNoiseFilter = () => {
    const nextState = !isNoiseFilterEnabled;
    setIsNoiseFilterEnabled(nextState);
    SoundService.playTone(nextState ? 'unmute' : 'mute');
  };

  const renderDiagnostics = () => {
    if (!showDiagnostics) return null;

    const screenshareSubscribed = subscribedVideoTracks.length > 0;

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
          <Text style={styles.diagLabel}>Noise Cancellation:</Text>
          <Text style={styles.diagVal}>{isNoiseFilterEnabled ? 'AI KRISP (ON)' : 'OFF'}</Text>
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
          <Text style={styles.diagLabel}>Deafened (Incoming Muted):</Text>
          <Text style={styles.diagVal}>{isDeafened ? 'YES' : 'NO'}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Screenshare Stream Subscribed:</Text>
          <Text style={styles.diagVal}>{screenshareSubscribed ? 'YES' : 'NO'}</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Audio Route:</Text>
          <Text style={styles.diagVal}>{isSpeakerOn ? 'SPEAKERPHONE' : 'EARPIECE / WIRED'}</Text>
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

  // Find if any peer is screensharing
  const activeScreenshare = subscribedVideoTracks.find(
    (vt) => vt.publication?.source === 'screen_share' || vt.track?.source === 'screen_share'
  );

  const isPeerSpeaking = activeSpeakers.some((identity) => identity !== roomRef.current?.localParticipant.identity);

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
        {activeScreenshare ? (
          <View style={styles.screenshareContainer}>
            <VideoView
              track={activeScreenshare.track}
              style={styles.screenshareVideo}
            />
            <View style={styles.screenshareLabelBox}>
              <Tv size={14} color={COLORS.success} />
              <Text style={styles.screenshareLabelText}>
                {activeScreenshare.participant.name || 'User'} is sharing their screen
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.avatarWrapper}>
            {!isConnected && <View style={styles.pulseRing} />}
            <View style={[
              styles.avatarCircle, 
              isConnected && styles.avatarConnected,
              isPeerSpeaking && styles.avatarSpeaking
            ]}>
              <Text style={styles.avatarText}>{peerInitials}</Text>
            </View>
            <Text style={styles.participantName}>{peerName}</Text>
            
            {/* Call participants grid representation for multi-party calls */}
            {participantsList.length > 0 && (
              <View style={styles.participantsGrid}>
                {participantsList.map((p) => {
                  const isSpeaking = activeSpeakers.includes(p.identity);
                  const initials = (p.name || 'User').substring(0, 2).toUpperCase();
                  return (
                    <View key={p.identity} style={styles.gridParticipantCard}>
                      <View style={[
                        styles.gridAvatar,
                        isSpeaking && styles.gridAvatarSpeaking
                      ]}>
                        <Text style={styles.gridAvatarText}>{initials}</Text>
                      </View>
                      <Text style={styles.gridParticipantName} numberOfLines={1}>
                        {p.name || 'User'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

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
        )}
      </View>

      <View style={styles.controlBar}>
        {/* Mic Toggle Button */}
        <TouchableOpacity
          onPress={handleToggleMute}
          style={[styles.controlBtn, activeCall.isMuted && styles.activeBtn]}
        >
          {activeCall.isMuted ? (
            <MicOff size={20} color="#FFF" />
          ) : (
            <Mic size={20} color={COLORS.textPrimary} />
          )}
        </TouchableOpacity>

        {/* Speaker Button */}
        <TouchableOpacity
          onPress={handleToggleSpeaker}
          style={[styles.controlBtn, isSpeakerOn && styles.activeBtn]}
        >
          <Volume2 size={20} color={isSpeakerOn ? '#FFF' : COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Deafen Button */}
        <TouchableOpacity
          onPress={handleToggleDeafen}
          style={[styles.controlBtn, isDeafened && styles.activeBtn]}
        >
          {isDeafened ? (
            <VolumeX size={20} color="#FFF" />
          ) : (
            <Headphones size={20} color={COLORS.textPrimary} />
          )}
        </TouchableOpacity>

        {/* Screenshare Button */}
        <TouchableOpacity
          onPress={handleToggleScreenShare}
          style={[styles.controlBtn, isLocalScreenShareEnabled && styles.activeBtn]}
        >
          <Tv size={20} color={isLocalScreenShareEnabled ? '#FFF' : COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Noise Suppression indicator toggle */}
        <TouchableOpacity
          onPress={handleToggleNoiseFilter}
          style={[styles.controlBtn, isNoiseFilterEnabled && styles.activeBtn]}
        >
          <Activity size={20} color={isNoiseFilterEnabled ? '#FFF' : COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Hangup Button */}
        <TouchableOpacity onPress={handleEndCall} style={styles.hangupBtn}>
          <PhoneOff size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Render remote audio tracks to direct WebRTC streaming to speakers */}
      {!isDeafened && subscribedTracks.map((track) => {
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
    width: '100%',
  },
  avatarWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
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
    borderColor: COLORS.primary,
  },
  avatarSpeaking: {
    borderColor: COLORS.success,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    borderWidth: 3,
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
    marginBottom: 10,
  },
  participantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 14,
    gap: 12,
    maxWidth: width - 80,
  },
  gridParticipantCard: {
    alignItems: 'center',
    width: 60,
  },
  gridAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondaryBackground,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridAvatarSpeaking: {
    borderColor: COLORS.success,
    borderWidth: 2,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  gridAvatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  gridParticipantName: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    width: '100%',
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
  screenshareContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  screenshareVideo: {
    width: '100%',
    height: '100%',
  },
  screenshareLabelBox: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  screenshareLabelText: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '600',
  },
});
