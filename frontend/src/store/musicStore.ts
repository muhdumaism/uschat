import { create } from 'zustand';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, API_BASE_URL } from '../api/client';
import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';

const { USChatMediaSessionModule } = NativeModules;

export interface Track {
  title: string;
  artist: string;
  duration: number; // seconds
  trackUri: string; // youtube/spotify link
  coverUrl: string | null;
  album?: string | null;
}

interface MusicState {
  currentTrack: Track | null;
  isPlaying: boolean;
  sound: Audio.Sound | null;
  queue: Track[];
  queueIndex: number;
  position: number; // ms
  duration: number; // ms
  isLooping: boolean;
  isShuffled: boolean;
  originalQueue: Track[];
  likedSongs: Track[];

  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  stopTrack: () => Promise<void>;
  setQueue: (tracks: Track[]) => void;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seek: (millis: number) => Promise<void>;
  seekTrack: (millis: number) => Promise<void>;
  toggleLoop: () => void;
  toggleShuffle: () => void;
  updateStatus: (status: any) => void;
  
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackUri: string) => void;
  likeTrack: (track: Track) => Promise<void>;
  unlikeTrack: (trackUri: string) => Promise<void>;
  fetchLikedSongs: () => Promise<void>;
  persistState: () => Promise<void>;
  initStore: () => Promise<void>;
}

export const useMusicStore = create<MusicState>((set, get) => {
  let isUpdating = false;

  const onPlaybackStatusUpdate = (status: any) => {
    if (!status || isUpdating) return;
    if (status.isLoaded) {
      set({
        position: status.positionMillis,
        duration: status.durationMillis || 0,
        isPlaying: status.isPlaying,
      });

      // Sync with Android MediaSession
      if (Platform.OS === 'android' && USChatMediaSessionModule) {
        USChatMediaSessionModule.updatePlaybackState(status.isPlaying, status.positionMillis);
      }

      if (status.didJustFinish) {
        get().nextTrack();
      }
    }
  };

  return {
    currentTrack: null,
    isPlaying: false,
    sound: null,
    queue: [],
    queueIndex: -1,
    position: 0,
    duration: 0,
    isLooping: false,
    isShuffled: false,
    originalQueue: [],
    likedSongs: [],

    playTrack: async (track: Track, newQueue?: Track[]) => {
      const state = get();
      
      if (state.sound) {
        try {
          isUpdating = true;
          await state.sound.unloadAsync();
        } catch (e) {
          console.warn('Sound unload error:', e);
        } finally {
          isUpdating = false;
        }
      }

      const activeQueue = newQueue || state.queue;
      const index = activeQueue.findIndex((t) => t.trackUri === track.trackUri);
      
      set({
        currentTrack: track,
        isPlaying: true,
        position: 0,
        duration: track.duration * 1000,
        queue: activeQueue,
        queueIndex: index !== -1 ? index : 0,
        originalQueue: newQueue ? [...newQueue] : state.originalQueue
      });

      try {
        const token = await AsyncStorage.getItem('@uschat/token');
        const streamUrl = `${API_BASE_URL}/music/stream?uri=${encodeURIComponent(track.trackUri)}`;

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          {
            uri: streamUrl,
            headers: {
              Authorization: `Bearer ${token || ''}`,
            },
          },
          {
            shouldPlay: true,
            isLooping: state.isLooping,
          },
          onPlaybackStatusUpdate
        );

        set({ sound });

        // Sync with Android MediaSession metadata
        if (Platform.OS === 'android' && USChatMediaSessionModule) {
          USChatMediaSessionModule.updateMetadata(
            track.title,
            track.artist,
            track.coverUrl || '',
            track.duration * 1000
          );
          USChatMediaSessionModule.updatePlaybackState(true, 0);
        }

        get().persistState();
      } catch (err) {
        console.error('Audio play error:', err);
        set({ isPlaying: false });
      }
    },

    pauseTrack: async () => {
      const state = get();
      if (state.sound && state.isPlaying) {
        try {
          await state.sound.pauseAsync();
          set({ isPlaying: false });
          if (Platform.OS === 'android' && USChatMediaSessionModule) {
            USChatMediaSessionModule.updatePlaybackState(false, state.position);
          }
          get().persistState();
        } catch (e) {}
      }
    },

    resumeTrack: async () => {
      const state = get();
      if (state.sound && !state.isPlaying) {
        try {
          await state.sound.playAsync();
          set({ isPlaying: true });
          if (Platform.OS === 'android' && USChatMediaSessionModule) {
            USChatMediaSessionModule.updatePlaybackState(true, state.position);
          }
          get().persistState();
        } catch (e) {}
      }
    },

    stopTrack: async () => {
      const state = get();
      if (state.sound) {
        try {
          await state.sound.stopAsync();
          set({ isPlaying: false, position: 0 });
          if (Platform.OS === 'android' && USChatMediaSessionModule) {
            USChatMediaSessionModule.stopMediaSession();
          }
          get().persistState();
        } catch (e) {}
      }
    },

    setQueue: (tracks: Track[]) => {
      set({ queue: tracks, originalQueue: [...tracks] });
      get().persistState();
    },

    nextTrack: async () => {
      const state = get();
      if (state.queue.length === 0) return;
      
      let nextIdx = state.queueIndex + 1;
      if (nextIdx >= state.queue.length) {
        nextIdx = 0; // Wrap around
      }

      const nextTrack = state.queue[nextIdx];
      if (nextTrack) {
        set({ queueIndex: nextIdx });
        await get().playTrack(nextTrack);
      }
    },

    prevTrack: async () => {
      const state = get();
      if (state.queue.length === 0) return;

      let prevIdx = state.queueIndex - 1;
      if (prevIdx < 0) {
        prevIdx = state.queue.length - 1;
      }

      const prevTrack = state.queue[prevIdx];
      if (prevTrack) {
        set({ queueIndex: prevIdx });
        await get().playTrack(prevTrack);
      }
    },

    seek: async (millis: number) => {
      const state = get();
      if (state.sound) {
        try {
          await state.sound.setPositionAsync(millis);
          set({ position: millis });
          if (Platform.OS === 'android' && USChatMediaSessionModule) {
            USChatMediaSessionModule.updatePlaybackState(state.isPlaying, millis);
          }
          get().persistState();
        } catch (e) {}
      }
    },

    seekTrack: async (millis: number) => {
      await get().seek(millis);
    },

    toggleLoop: () => {
      const state = get();
      const nextLoop = !state.isLooping;
      set({ isLooping: nextLoop });
      if (state.sound) {
        state.sound.setIsLoopingAsync(nextLoop);
      }
      get().persistState();
    },

    toggleShuffle: () => {
      const state = get();
      const nextShuffle = !state.isShuffled;
      set({ isShuffled: nextShuffle });

      if (nextShuffle) {
        const shuffled = [...state.queue].sort(() => Math.random() - 0.5);
        if (state.currentTrack) {
          const idx = shuffled.findIndex((t) => t.trackUri === state.currentTrack?.trackUri);
          if (idx !== -1) {
            shuffled.splice(idx, 1);
            shuffled.unshift(state.currentTrack);
          }
        }
        set({ queue: shuffled, queueIndex: 0 });
      } else {
        const origIdx = state.originalQueue.findIndex((t) => t.trackUri === state.currentTrack?.trackUri);
        set({ queue: state.originalQueue, queueIndex: origIdx !== -1 ? origIdx : 0 });
      }
      get().persistState();
    },

    updateStatus: (status: any) => {
      onPlaybackStatusUpdate(status);
    },

    addToQueue: (track: Track) => {
      const state = get();
      if (!state.queue.some(t => t.trackUri === track.trackUri)) {
        set({ queue: [...state.queue, track], originalQueue: [...state.originalQueue, track] });
        get().persistState();
      }
    },

    removeFromQueue: (trackUri: string) => {
      const state = get();
      set({
        queue: state.queue.filter(t => t.trackUri !== trackUri),
        originalQueue: state.originalQueue.filter(t => t.trackUri !== trackUri),
      });
      get().persistState();
    },

    likeTrack: async (track: Track) => {
      try {
        await apiClient.post('/music/like', {
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          coverUrl: track.coverUrl,
          trackUri: track.trackUri
        });
        set({ likedSongs: [...get().likedSongs, track] });
      } catch (e) {
        console.warn('Failed to like song:', e);
      }
    },

    unlikeTrack: async (trackUri: string) => {
      try {
        await apiClient.delete(`/music/unlike?trackUri=${encodeURIComponent(trackUri)}`);
        set({ likedSongs: get().likedSongs.filter(t => t.trackUri !== trackUri) });
      } catch (e) {
        console.warn('Failed to unlike song:', e);
      }
    },

    fetchLikedSongs: async () => {
      try {
        const res = await apiClient.get('/music/liked');
        set({ likedSongs: res.data || [] });
      } catch (e) {
        console.warn('Failed to fetch liked songs:', e);
      }
    },

    persistState: async () => {
      const state = get();
      try {
        const data = {
          currentTrack: state.currentTrack,
          queue: state.queue,
          queueIndex: state.queueIndex,
          isLooping: state.isLooping,
          isShuffled: state.isShuffled,
          originalQueue: state.originalQueue,
          position: state.position,
        };
        await AsyncStorage.setItem('@uschat/music_state', JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to save music state:', e);
      }
    },

    initStore: async () => {
      try {
        const saved = await AsyncStorage.getItem('@uschat/music_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          set({
            currentTrack: parsed.currentTrack || null,
            queue: parsed.queue || [],
            queueIndex: parsed.queueIndex !== undefined ? parsed.queueIndex : -1,
            isLooping: !!parsed.isLooping,
            isShuffled: !!parsed.isShuffled,
            originalQueue: parsed.originalQueue || [],
            position: parsed.position || 0,
          });

          if (parsed.currentTrack) {
            const token = await AsyncStorage.getItem('@uschat/token');
            const streamUrl = `${API_BASE_URL}/music/stream?uri=${encodeURIComponent(parsed.currentTrack.trackUri)}`;

            // Build audio session configuration
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
              staysActiveInBackground: true,
              playThroughEarpieceAndroid: false,
            });

            const { sound } = await Audio.Sound.createAsync(
              {
                uri: streamUrl,
                headers: {
                  Authorization: `Bearer ${token || ''}`,
                },
              },
              {
                shouldPlay: false, // Start paused on launch
                positionMillis: parsed.position || 0,
                isLooping: !!parsed.isLooping,
              },
              onPlaybackStatusUpdate
            );

            set({ sound });

            // Sync with Android MediaSession metadata as paused state
            if (Platform.OS === 'android' && USChatMediaSessionModule) {
              USChatMediaSessionModule.updateMetadata(
                parsed.currentTrack.title,
                parsed.currentTrack.artist,
                parsed.currentTrack.coverUrl || '',
                parsed.currentTrack.duration * 1000
              );
              USChatMediaSessionModule.updatePlaybackState(false, parsed.position || 0);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load music state:', e);
      }
    },
  };
});

if (Platform.OS === 'android' && USChatMediaSessionModule) {
  DeviceEventEmitter.addListener('onMediaSessionAction', async (event: any) => {
    const { action, params } = event;
    const store = useMusicStore.getState();
    switch (action) {
      case 'play':
        await store.resumeTrack();
        break;
      case 'pause':
        await store.pauseTrack();
        break;
      case 'next':
        await store.nextTrack();
        break;
      case 'previous':
        await store.prevTrack();
        break;
      case 'seekTo':
        if (params && typeof params.position === 'number') {
          await store.seekTrack(params.position);
        }
        break;
    }
  });
}
