import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react-native';
import { useCallStore } from '../../store/callStore';
import { Avatar } from '../../components/Avatar';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../../theme/brutalistTheme';

export const CallScreen: React.FC<any> = ({ navigation }) => {
  const { colors, isDarkMode } = useBrutalistTheme();
  const {
    targetName,
    status,
    isMuted,
    isSpeaker,
    duration,
    acceptCall,
    rejectCall,
    hangupCall,
    toggleMute,
    toggleSpeaker,
  } = useCallStore();

  useEffect(() => {
    // If call goes back to idle, automatically exit call screen
    if (status === 'idle') {
      try {
        navigation.navigate('Home');
      } catch (err) {
        navigation.goBack();
      }
    }
  }, [status]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getStatusText = () => {
    switch (status) {
      case 'dialing': return 'DIALING...';
      case 'ringing': return 'RINGING...';
      case 'incoming': return 'INCOMING VOICE CALL';
      case 'connected': return formatDuration(duration);
      default: return 'CONNECTING...';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.content}>
        {/* Caller Info Block */}
        <View style={styles.profileSection}>
          <Avatar name={targetName || 'User'} size={120} />
          <Text style={[styles.nameText, { color: colors.textPrimary }]}>
            {(targetName || 'UNKNOWN USER').toUpperCase()}
          </Text>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {getStatusText()}
          </Text>
        </View>

        {/* Transport Action Bar */}
        <View style={styles.actionSection}>
          {status === 'incoming' ? (
            // Incoming Call: Reject and Accept Buttons
            <View style={styles.incomingRow}>
              <TouchableOpacity
                onPress={rejectCall}
                style={[styles.circleBtn, styles.declineBtn, { borderColor: '#000000' }]}
              >
                <PhoneOff size={28} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={acceptCall}
                style={[styles.circleBtn, styles.acceptBtn, { borderColor: '#000000' }]}
              >
                <Phone size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            // Outgoing/Active Call: Mute, Speaker, and Hangup Buttons
            <View style={styles.activeRow}>
              <TouchableOpacity
                onPress={toggleMute}
                style={[
                  styles.circleBtn,
                  styles.controlBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: isMuted ? colors.yellow : colors.cardBg,
                  },
                ]}
              >
                {isMuted ? <MicOff size={24} color="#000000" /> : <Mic size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={hangupCall}
                style={[styles.circleBtn, styles.declineBtn, { borderColor: '#000000' }]}
              >
                <PhoneOff size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={toggleSpeaker}
                style={[
                  styles.circleBtn,
                  styles.controlBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: isSpeaker ? colors.yellow : colors.cardBg,
                  },
                ]}
              >
                {isSpeaker ? <Volume2 size={24} color="#000000" /> : <VolumeX size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 50,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 60,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginTop: 20,
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginTop: 10,
    letterSpacing: 1.5,
  },
  actionSection: {
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  declineBtn: {
    backgroundColor: '#FF3B30', // Neo red
  },
  acceptBtn: {
    backgroundColor: '#4CD964', // Neo green
  },
  controlBtn: {
    borderWidth: 2,
    shadowOffset: { width: 2, height: 2 },
  },
});
