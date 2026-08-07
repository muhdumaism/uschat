import { create } from 'zustand';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, API_BASE_URL } from '../api/client';

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
        } catch (e) {}
      }
    },

    resumeTrack: async () => {
      const state = get();
      if (state.sound && !state.isPlaying) {
        try {
          await state.sound.playAsync();
          set({ isPlaying: true });
        } catch (e) {}
      }
    },

    stopTrack: async () => {
      const state = get();
      if (state.sound) {
        try {
          await state.sound.stopAsync();
          set({ isPlaying: false, position: 0 });
        } catch (e) {}
      }
    },

    setQueue: (tracks: Track[]) => {
      set({ queue: tracks, originalQueue: [...tracks] });
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
    },

    updateStatus: (status: any) => {
      onPlaybackStatusUpdate(status);
    },

    addToQueue: (track: Track) => {
      const state = get();
      if (!state.queue.some(t => t.trackUri === track.trackUri)) {
        set({ queue: [...state.queue, track], originalQueue: [...state.originalQueue, track] });
      }
    },

    removeFromQueue: (trackUri: string) => {
      const state = get();
      set({
        queue: state.queue.filter(t => t.trackUri !== trackUri),
        originalQueue: state.originalQueue.filter(t => t.trackUri !== trackUri),
      });
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
  };
});
