import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
  Modal,
  ScrollView,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  ListMusic,
  Maximize2,
  Minimize2,
  Shuffle,
  Repeat,
  Trash2,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../theme/brutalistTheme';
import { useMusicStore, Track } from '../store/musicStore';
import { apiClient } from '../api/client';
import Slider from '@react-native-community/slider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FloatingMiniPlayer: React.FC = () => {
  const { colors, isDarkMode } = useBrutalistTheme();
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    isLooping,
    isShuffled,
    queue,
    likedSongs,
    playTrack,
    pauseTrack,
    resumeTrack,
    nextTrack,
    prevTrack,
    toggleLoop,
    toggleShuffle,
    removeFromQueue,
    setQueue,
    likeTrack,
    unlikeTrack,
    seekTrack,
  } = useMusicStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string>('Home');

  // Shared value for expand/collapse interpolation
  const expandProgress = useSharedValue(0);

  // Monitor screen route changes to hide player on Login, Register, Call screens
  useEffect(() => {
    const routeListener = DeviceEventEmitter.addListener('onNavigationStateChange', (route: string) => {
      setActiveRoute(route);
    });
    return () => {
      routeListener.remove();
    };
  }, []);

  useEffect(() => {
    expandProgress.value = withTiming(isExpanded ? 1 : 0, { duration: 320 });
  }, [isExpanded]);

  const isLiked = currentTrack ? likedSongs.some((s: any) => s.trackUri === currentTrack.trackUri) : false;

  // Formatting utility
  const formatTime = (millis: number) => {
    const totalSecs = Math.floor(millis / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Expand animated style (capsule to full screen)
  const animatedContainerStyle = useAnimatedStyle(() => {
    const bottomOffset = Platform.OS === 'android' ? 24 : 36;
    return {
      height: interpolate(expandProgress.value, [0, 1], [72, SCREEN_HEIGHT]),
      borderRadius: interpolate(expandProgress.value, [0, 1], [16, 0]),
      bottom: interpolate(expandProgress.value, [0, 1], [bottomOffset, 0]),
      left: interpolate(expandProgress.value, [0, 1], [12, 0]),
      right: interpolate(expandProgress.value, [0, 1], [12, 0]),
      borderWidth: interpolate(expandProgress.value, [0, 1], [BRUTALIST_STYLES.borderWidth, 0]),
      elevation: interpolate(expandProgress.value, [0, 1], [6, 0]),
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(expandProgress.value, [0, 0.4, 1], [1, 0, 1]),
    };
  });

  // Swipe gesture handlers
  const onPanGesture = (event: any) => {
    const { translationX, translationY } = event.nativeEvent;

    // Handle horizontal swipes for skipping tracks in collapsed view
    if (!isExpanded && Math.abs(translationX) > 60 && Math.abs(translationY) < 30) {
      if (translationX < 0) {
        nextTrack();
      } else {
        prevTrack();
      }
    }

    // Handle vertical downswipe for collapsing expanded view
    if (isExpanded && translationY > 80) {
      setIsExpanded(false);
    }
  };

  // Double tap artwork -> toggle like
  const onDoubleTapArtwork = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE && currentTrack) {
      if (isLiked) {
        unlikeTrack(currentTrack.trackUri);
      } else {
        likeTrack(currentTrack);
      }
    }
  };

  // Perform conditional rendering checks after all hooks are evaluated
  if (!currentTrack) return null;
  const hiddenScreens = ['Login', 'Register', 'Call'];
  if (hiddenScreens.includes(activeRoute)) return null;

  return (
    <GestureHandlerRootView style={[styles.gestureWrapper, isExpanded && styles.fullscreen]}>
      <PanGestureHandler onGestureEvent={onPanGesture} activeOffsetY={[-10, 10]}>
        <Animated.View
          style={[
            styles.container,
            animatedContainerStyle,
            {
              backgroundColor: isDarkMode ? 'rgba(15,15,15,0.85)' : 'rgba(255,255,255,0.88)',
              borderColor: colors.border,
            },
          ]}
        >
          {Platform.OS === 'ios' && (
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint={isDarkMode ? 'dark' : 'light'} />
          )}

          {!isExpanded ? (
            /* COLLAPSED MINI PLAYER VIEW */
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => setIsExpanded(true)}
              onLongPress={() => setShowQuickActions(true)}
              style={styles.miniRow}
            >
              <TapGestureHandler onHandlerStateChange={onDoubleTapArtwork} numberOfTaps={2}>
                <View style={[styles.artworkContainer, { borderColor: colors.border }]}>
                  {currentTrack.coverUrl ? (
                    <Image source={{ uri: currentTrack.coverUrl }} style={styles.miniArtwork} />
                  ) : (
                    <View style={[styles.fallbackArt, { backgroundColor: colors.yellow }]}>
                      <Text style={styles.fallbackText}>★</Text>
                    </View>
                  )}
                </View>
              </TapGestureHandler>

              <View style={styles.metadataArea}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                  {currentTrack.title.toUpperCase()}
                </Text>
                <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
                  {currentTrack.artist.toUpperCase()}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => (isLiked ? unlikeTrack(currentTrack.trackUri) : likeTrack(currentTrack))}
                  style={styles.miniIconBtn}
                >
                  <Heart
                    size={16}
                    color={isLiked ? BRUTALIST_COLORS.red : colors.textPrimary}
                    fill={isLiked ? BRUTALIST_COLORS.red : 'transparent'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={isPlaying ? pauseTrack : resumeTrack}
                  style={[styles.playPauseCapsule, { backgroundColor: colors.yellow, borderColor: colors.border }]}
                >
                  {isPlaying ? (
                    <Pause size={12} color="#000000" fill="#000000" />
                  ) : (
                    <Play size={12} color="#000000" fill="#000000" style={{ marginLeft: 1 }} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Progress Line Bar */}
              <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? '#222' : '#EEE' }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${duration > 0 ? (position / duration) * 100 : 0}%`,
                      backgroundColor: BRUTALIST_COLORS.pink,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          ) : (
            /* EXPANDED FULL SCREEN PLAYER VIEW */
            <Animated.View style={[styles.expandedWrapper, animatedContentStyle]}>
              {/* Header */}
              <View style={styles.expandedHeader}>
                <TouchableOpacity onPress={() => setIsExpanded(false)} style={styles.headerBtn}>
                  <Minimize2 size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>NOW PLAYING</Text>
                <TouchableOpacity onPress={() => setShowQueue(true)} style={styles.headerBtn}>
                  <ListMusic size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Big Artwork */}
              <TapGestureHandler onHandlerStateChange={onDoubleTapArtwork} numberOfTaps={2}>
                <View style={[styles.largeArtworkWrapper, { borderColor: colors.border }]}>
                  {currentTrack.coverUrl ? (
                    <Image source={{ uri: currentTrack.coverUrl }} style={styles.largeArtwork} />
                  ) : (
                    <View style={[styles.largeFallbackArt, { backgroundColor: colors.green }]}>
                      <Text style={styles.largeFallbackText}>★</Text>
                    </View>
                  )}
                </View>
              </TapGestureHandler>

              {/* Title & Likes */}
              <View style={styles.expandedMetadataRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.largeTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {currentTrack.title.toUpperCase()}
                  </Text>
                  <Text style={[styles.largeArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                    {currentTrack.artist.toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => (isLiked ? unlikeTrack(currentTrack.trackUri) : likeTrack(currentTrack))}
                  style={[styles.largeHeartBtn, { borderColor: colors.border }]}
                >
                  <Heart
                    size={22}
                    color={isLiked ? BRUTALIST_COLORS.red : colors.textPrimary}
                    fill={isLiked ? BRUTALIST_COLORS.red : 'transparent'}
                  />
                </TouchableOpacity>
              </View>

              {/* Seeker Progress Section */}
              <View style={styles.seekerSection}>
                <Slider
                  minimumValue={0}
                  maximumValue={duration}
                  value={position}
                  onSlidingComplete={seekTrack}
                  minimumTrackTintColor={colors.textPrimary}
                  maximumTrackTintColor={isDarkMode ? '#333333' : '#CCCCCC'}
                  thumbTintColor={colors.textPrimary}
                  style={styles.slider}
                />
                <View style={styles.timeLabelRow}>
                  <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(position)}</Text>
                  <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(duration)}</Text>
                </View>
              </View>

              {/* Transport Controls */}
              <View style={styles.controlRow}>
                <TouchableOpacity
                  onPress={toggleShuffle}
                  style={[styles.expandedMiniBtn, isShuffled && { backgroundColor: colors.pink }]}
                >
                  <Shuffle size={18} color={colors.textPrimary} />
                </TouchableOpacity>

                <TouchableOpacity onPress={prevTrack} style={styles.transportBtn}>
                  <SkipBack size={24} color="#000000" fill="#000000" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={isPlaying ? pauseTrack : resumeTrack}
                  style={[styles.largePlayPause, { backgroundColor: colors.green, borderColor: colors.border }]}
                >
                  {isPlaying ? (
                    <Pause size={30} color="#000000" fill="#000000" />
                  ) : (
                    <Play size={30} color="#000000" fill="#000000" style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={nextTrack} style={styles.transportBtn}>
                  <SkipForward size={24} color="#000000" fill="#000000" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleLoop}
                  style={[styles.expandedMiniBtn, isLooping && { backgroundColor: colors.pink }]}
                >
                  <Repeat size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </PanGestureHandler>

      {/* QUEUE BOTTOM SHEET MODAL */}
      <Modal visible={showQueue} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.queueSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.queueHeader}>
              <Text style={[styles.queueTitle, { color: colors.textPrimary }]}>PLAYBACK QUEUE</Text>
              <TouchableOpacity onPress={() => setShowQueue(false)} style={styles.queueCloseBtn}>
                <Text style={{ fontWeight: 'bold' }}>CLOSE</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {currentTrack && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>NOW PLAYING</Text>
                  <View style={[styles.queueItemActive, { borderColor: colors.border, backgroundColor: colors.yellow }]}>
                    <Text style={styles.queueItemText} numberOfLines={1}>
                      {currentTrack.title.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              {queue.length > 0 && <Text style={[styles.label, { color: colors.textPrimary }]}>UPCOMING SONGS</Text>}

              {queue.map((track, index) => {
                const isCurrent = track.trackUri === currentTrack.trackUri;
                return (
                  <View
                    key={`${track.trackUri}-${index}`}
                    style={[
                      styles.queueItem,
                      { borderColor: colors.border, backgroundColor: isCurrent ? colors.yellow : colors.cardBg },
                    ]}
                  >
                    <Text style={[styles.queueItemText, { flex: 1 }]} numberOfLines={1}>
                      {track.title.toUpperCase()}
                    </Text>
                    <TouchableOpacity onPress={() => removeFromQueue(track.trackUri)}>
                      <Trash2 size={16} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QUICK ACTIONS CONTEXT SHEET */}
      <Modal visible={showQuickActions} animationType="fade" transparent>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowQuickActions(false)}
          style={styles.modalBackdrop}
        >
          <View style={[styles.quickActionsBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>{currentTrack.title.toUpperCase()}</Text>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                setShowQuickActions(false);
                if (isLiked) {
                  unlikeTrack(currentTrack.trackUri);
                } else {
                  likeTrack(currentTrack);
                }
              }}
            >
              <Heart size={16} color={isLiked ? BRUTALIST_COLORS.red : colors.textPrimary} />
              <Text style={{ fontWeight: 'bold' }}>{isLiked ? 'REMOVE FROM LIKES' : 'LIKE THIS TRACK'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                setShowQuickActions(false);
                setShowQueue(true);
              }}
            >
              <ListMusic size={16} color={colors.textPrimary} />
              <Text style={{ fontWeight: 'bold' }}>SHOW PLAYBACK QUEUE</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  gestureWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  fullscreen: {
    top: 0,
    height: SCREEN_HEIGHT,
  },
  container: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  },
  miniRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  artworkContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    marginRight: 12,
  },
  miniArtwork: {
    width: '100%',
    height: '100%',
  },
  fallbackArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  metadataArea: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  artist: {
    fontSize: 8,
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniIconBtn: {
    padding: 6,
  },
  playPauseCapsule: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressBarFill: {
    height: '100%',
  },
  expandedWrapper: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  largeArtworkWrapper: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_WIDTH - 48,
    alignSelf: 'center',
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
    marginBottom: 24,
  },
  largeArtwork: {
    width: '100%',
    height: '100%',
  },
  largeFallbackArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeFallbackText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#000000',
  },
  expandedMetadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  largeTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  largeArtist: {
    fontSize: 12,
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginTop: 4,
  },
  largeHeartBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekerSection: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  timeText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  expandedMiniBtn: {
    padding: 10,
    borderRadius: 8,
  },
  transportBtn: {
    padding: 12,
  },
  largePlayPause: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: BRUTALIST_STYLES.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  queueSheet: {
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderBottomWidth: 0,
    padding: 20,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  queueTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  queueCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginBottom: 8,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  queueItemActive: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  queueItemText: {
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  quickActionsBox: {
    margin: 20,
    borderRadius: 16,
    borderWidth: BRUTALIST_STYLES.borderWidth,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
});
