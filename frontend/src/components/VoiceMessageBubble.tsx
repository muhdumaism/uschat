import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../theme/colors';

// Static references to enforce single-audio playback globally (like WhatsApp/Telegram)
let activeSoundInstance: Audio.Sound | null = null;
let activePauseCallback: (() => void) | null = null;

interface VoiceMessageBubbleProps {
  audioUrl: string;
  duration: number; // in seconds
  waveform: number[]; // array of normalized volume floats
  isSender: boolean;
  timestamp: string;
  isViewed: boolean;
}

export const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({
  audioUrl,
  duration,
  waveform,
  isSender,
  timestamp,
  isViewed,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(duration * 1000);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [localUri, setLocalUri] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);

  // Resample waveform array to standard width of 35 bars
  const targetBars = 32;
  const resampledWaveform = React.useMemo(() => {
    if (!waveform || waveform.length === 0) {
      return Array(targetBars).fill(0.15);
    }
    const step = waveform.length / targetBars;
    const result = [];
    for (let i = 0; i < targetBars; i++) {
      const index = Math.floor(i * step);
      const val = waveform[index] !== undefined ? waveform[index] : 0.15;
      // Guarantee a minimum height for visibility
      result.push(Math.max(0.1, val));
    }
    return result;
  }, [waveform]);

  // Download & Cache audio file on mount for offline usage
  useEffect(() => {
    let isMounted = true;
    const cacheAudio = async () => {
      try {
        const filename = audioUrl.substring(audioUrl.lastIndexOf('/') + 1) || `voice_${Date.now()}.m4a`;
        // Ensure folder exists and construct cache path
        const cachePath = `${FileSystem.cacheDirectory}${filename}`;
        const fileInfo = await FileSystem.getInfoAsync(cachePath);

        if (fileInfo.exists) {
          if (isMounted) setLocalUri(cachePath);
        } else {
          const downloadRes = await FileSystem.downloadAsync(audioUrl, cachePath);
          if (isMounted) setLocalUri(downloadRes.uri);
        }
      } catch (err) {
        console.warn('Voice message caching error:', err);
        // Fallback to original URL
        if (isMounted) setLocalUri(audioUrl);
      }
    };
    cacheAudio();

    return () => {
      isMounted = false;
      unloadSound();
    };
  }, [audioUrl]);

  const unloadSound = async () => {
    if (soundRef.current) {
      try {
        if (activeSoundInstance === soundRef.current) {
          activeSoundInstance = null;
          activePauseCallback = null;
        }
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
  };

  const loadSound = async (uriToPlay: string): Promise<Audio.Sound> => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: uriToPlay },
      { shouldPlay: false, rate: playbackSpeed, shouldCorrectPitch: true, isLooping: false },
      onPlaybackStatusUpdate
    );
    soundRef.current = sound;
    return sound;
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (!status) return;

    if (status.isLoaded) {
      setPositionMillis(status.positionMillis);
      if (status.durationMillis) {
        setDurationMillis(status.durationMillis);
      }

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPositionMillis(0);
        try {
          soundRef.current?.setStatusAsync({ shouldPlay: false, positionMillis: 0 });
        } catch (err) {}
      }
    } else if (status.error) {
      console.warn(`Playback status error: ${status.error}`);
    }
  };

  const handlePlayPause = async () => {
    if (!localUri) return;

    try {
      // 1. If currently playing, pause
      if (isPlaying) {
        await soundRef.current?.pauseAsync();
        setIsPlaying(false);
        return;
      }

      setIsLoading(true);

      // Pause other playing sounds
      if (activeSoundInstance && activePauseCallback) {
        try {
          await activeSoundInstance.pauseAsync();
          activePauseCallback();
        } catch (e) {}
      }

      // 2. Initialize sound if not loaded yet
      let sound = soundRef.current;
      if (!sound) {
        sound = await loadSound(localUri);
      }

      // Set global active audio references
      activeSoundInstance = sound;
      activePauseCallback = () => {
        setIsPlaying(false);
      };

      // 3. Play from current position
      await sound.setRateAsync(playbackSpeed, true);
      await sound.playAsync();
      setIsPlaying(true);
    } catch (err) {
      console.warn('Playback play/pause error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCycleSpeed = async () => {
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0];
    const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackSpeed(nextSpeed);

    if (soundRef.current) {
      try {
        await soundRef.current.setRateAsync(nextSpeed, true);
      } catch (e) {}
    }
  };

  // Seek audio position by tapping on the waveform
  const handleSeek = (e: any) => {
    if (!soundRef.current || isLoading) return;
    const touchX = e.nativeEvent.locationX;
    const containerWidth = 160; // Approximated waveform layout width
    const progress = touchX / containerWidth;
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const targetPosition = clampedProgress * durationMillis;

    setPositionMillis(targetPosition);
    soundRef.current.setPositionAsync(targetPosition);
  };

  const formatTime = (millis: number) => {
    const totalSecs = Math.floor(millis / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentPlayPercentage = durationMillis > 0 ? positionMillis / durationMillis : 0;

  return (
    <View style={styles.bubbleContainer}>
      <View style={styles.mainRow}>
        {/* Play/Pause Button */}
        <TouchableOpacity
          onPress={handlePlayPause}
          style={[styles.playBtn, isSender ? styles.senderPlayBtn : styles.receiverPlayBtn]}
          disabled={!localUri || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : isPlaying ? (
            <Pause size={20} color="#FFF" fill="#FFF" />
          ) : (
            <Play size={20} color="#FFF" fill="#FFF" style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>

        {/* Waveform and Timers */}
        <View style={styles.waveformColumn}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleSeek}
            style={styles.waveformContainer}
          >
            {resampledWaveform.map((barVal, index) => {
              const barProgress = index / targetBars;
              const isPlayed = barProgress <= currentPlayPercentage;
              const barHeight = Math.max(4, Math.min(28, barVal * 28));

              return (
                <View
                  key={index}
                  style={[
                    styles.waveformBar,
                    {
                      height: barHeight,
                      backgroundColor: isPlayed
                        ? (isSender ? '#FFF' : COLORS.primary)
                        : (isSender ? 'rgba(255, 255, 255, 0.35)' : '#444'),
                    },
                  ]}
                />
              );
            })}
          </TouchableOpacity>

          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, isSender ? styles.senderText : styles.receiverText]}>
              {formatTime(positionMillis)} / {formatTime(durationMillis)}
            </Text>
          </View>
        </View>

        {/* Playback Speed Cycler Badge */}
        <TouchableOpacity
          onPress={handleCycleSpeed}
          style={[styles.speedBadge, isSender ? styles.senderSpeedBadge : styles.receiverSpeedBadge]}
        >
          <Text style={styles.speedText}>{playbackSpeed}x</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bubbleContainer: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 230,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  senderPlayBtn: {
    backgroundColor: COLORS.primary,
  },
  receiverPlayBtn: {
    backgroundColor: '#333',
  },
  waveformColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 160,
    height: 32,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  senderText: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  receiverText: {
    color: COLORS.textMuted,
  },
  speedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  senderSpeedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  receiverSpeedBadge: {
    backgroundColor: '#2A2A2A',
  },
  speedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
