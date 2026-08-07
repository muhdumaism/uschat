import { create } from 'zustand';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api/client';

export interface Track {
  title: string;
  artist: string;
  duration: number; // seconds
  trackUri: string; // youtube/spotify link
  coverUrl: string | null;
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

  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  stopTrack: () => Promise<void>;
  setQueue: (tracks: Track[]) => void;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seek: (millis: number) => Promise<void>;
  toggleLoop: () => void;
  toggleShuffle: () => void;
  updateStatus: (status: any) => void;
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

      if (status.didJustFinish) {
        // Auto play next track
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

    playTrack: async (track: Track, newQueue?: Track[]) => {
      const state = get();
      
      // Stop and unload existing sound
      if (state.sound) {
        try {
          await state.sound.unloadAsync();
        } catch (e) {}
      }

      // Configure queue
      let activeQueue = state.queue;
      let activeIndex = state.queueIndex;

      if (newQueue) {
        activeQueue = newQueue;
        activeIndex = newQueue.findIndex((t) => t.trackUri === track.trackUri);
        set({ queue: newQueue, originalQueue: newQueue, queueIndex: activeIndex });
      } else {
        // Add to queue if not present
        const idx = activeQueue.findIndex((t) => t.trackUri === track.trackUri);
        if (idx === -1) {
          activeQueue = [...activeQueue, track];
          activeIndex = activeQueue.length - 1;
          set({ queue: activeQueue, originalQueue: activeQueue, queueIndex: activeIndex });
        } else {
          activeIndex = idx;
          set({ queueIndex: activeIndex });
        }
      }

      set({ currentTrack: track, isPlaying: true, position: 0, duration: track.duration * 1000 });

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
      } catch (err) {
        console.error('[MusicStore] Play track failed:', err);
        set({ isPlaying: false, sound: null });
      }
    },

    pauseTrack: async () => {
      const state = get();
      if (state.sound && state.isPlaying) {
        try {
          isUpdating = true;
          await state.sound.pauseAsync();
          set({ isPlaying: false });
        } catch (e) {
        } finally {
          isUpdating = false;
        }
      }
    },

    resumeTrack: async () => {
      const state = get();
      if (state.sound && !state.isPlaying) {
        try {
          isUpdating = true;
          await state.sound.playAsync();
          set({ isPlaying: true });
        } catch (e) {
        } finally {
          isUpdating = false;
        }
      }
    },

    stopTrack: async () => {
      const state = get();
      if (state.sound) {
        try {
          await state.sound.unloadAsync();
        } catch (e) {}
      }
      set({ currentTrack: null, isPlaying: false, sound: null, position: 0, duration: 0 });
    },

    setQueue: (tracks: Track[]) => {
      set({ queue: tracks, originalQueue: tracks, queueIndex: -1 });
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
        prevIdx = state.queue.length - 1; // Wrap around
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
        } catch (e) {}
      }
    },

    toggleLoop: () => {
      const state = get();
      const nextLoop = !state.isLooping;
      set({ isLooping: nextLoop });
      if (state.sound) {
        state.sound.setIsLoopingAsync(nextLoop);
      }
    },

    toggleShuffle: () => {
      const state = get();
      const nextShuffle = !state.isShuffled;
      set({ isShuffled: nextShuffle });

      if (nextShuffle) {
        // Shuffle queue
        const shuffled = [...state.queue].sort(() => Math.random() - 0.5);
        // Move current track to start of shuffled queue
        if (state.currentTrack) {
          const idx = shuffled.findIndex((t) => t.trackUri === state.currentTrack?.trackUri);
          if (idx !== -1) {
            shuffled.splice(idx, 1);
            shuffled.unshift(state.currentTrack);
          }
        }
        set({ queue: shuffled, queueIndex: 0 });
      } else {
        // Reset to original queue order
        const origIdx = state.originalQueue.findIndex((t) => t.trackUri === state.currentTrack?.trackUri);
        set({ queue: state.originalQueue, queueIndex: origIdx !== -1 ? origIdx : 0 });
      }
    },

    updateStatus: (status: any) => {
      onPlaybackStatusUpdate(status);
    },
  };
});
