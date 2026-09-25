import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import { YouTubeBridgeApi } from '../components/YouTubePlayerBridge';

const { USChatMediaSessionModule } = NativeModules;

export interface Track {
  title: string;
  artist: string;
  duration: number; // in seconds
  trackUri: string; // YouTube watch link or direct videoId
  coverUrl: string | null;
  album?: string | null;
}

export function extractYouTubeVideoId(urlOrId: string): string {
  if (!urlOrId) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : urlOrId;
}

interface MusicState {
  currentTrack: Track | null;
  isPlaying: boolean;
  bridge: YouTubeBridgeApi | null;
  queue: Track[];
  queueIndex: number;
  position: number; // in milliseconds
  duration: number; // in milliseconds
  isLooping: boolean;
  isShuffled: boolean;
  originalQueue: Track[];
  likedSongs: Track[];

  setBridge: (bridge: YouTubeBridgeApi | null) => void;
  handlePlayerEvent: (type: string, data: any) => void;

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
  return {
    currentTrack: null,
    isPlaying: false,
    bridge: null,
    queue: [],
    queueIndex: -1,
    position: 0,
    duration: 0,
    isLooping: false,
    isShuffled: false,
    originalQueue: [],
    likedSongs: [],

    setBridge: (bridge) => set({ bridge }),

    updateStatus: (status: any) => {
      if (status) {
        set({
          position: status.positionMillis || 0,
          duration: status.durationMillis || 0,
          isPlaying: status.isPlaying ?? false,
        });
      }
    },

    handlePlayerEvent: (type: string, data: any) => {
      const state = get();

      switch (type) {
        case 'READY':
          console.log('[MusicStore] YouTube IFrame player bridge is ready');
          break;

        case 'STATE_CHANGE': {
          // YT.PlayerState: ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3, CUED = 5
          const ytState = data.state;
          const posMs = Math.floor((data.currentTime || 0) * 1000);
          const durMs = Math.floor((data.duration || 0) * 1000);

          if (ytState === 1) {
            // PLAYING
            set({ isPlaying: true, position: posMs, duration: durMs || state.duration });
            if (Platform.OS === 'android' && USChatMediaSessionModule) {
              USChatMediaSessionModule.updatePlaybackState(true, posMs);
            }
          } else if (ytState === 2) {
            // PAUSED
            set({ isPlaying: false, position: posMs });
            if (Platform.OS === 'android' && USChatMediaSessionModule) {
              USChatMediaSessionModule.updatePlaybackState(false, posMs);
            }
          } else if (ytState === 0) {
            // ENDED - Infinite loop protection: Only advance if played for >1s
            if (state.position > 1000) {
              if (state.isLooping && state.currentTrack) {
                get().playTrack(state.currentTrack);
              } else {
                get().nextTrack();
              }
            } else {
              console.warn('[MusicStore] Track ended prematurely (<1s), halting auto-advance.');
              set({ isPlaying: false });
              if (Platform.OS === 'android' && USChatMediaSessionModule) {
                USChatMediaSessionModule.updatePlaybackState(false, 0);
              }
            }
          }
          break;
        }

        case 'TIME_UPDATE': {
          const currentMs = Math.floor((data.currentTime || 0) * 1000);
          const durMs = Math.floor((data.duration || 0) * 1000);
          set({ position: currentMs, duration: durMs || state.duration });
          break;
        }

        case 'ERROR': {
          console.error('[MusicStore] YouTube IFrame error code:', data.code);
          set({ isPlaying: false });
          if (Platform.OS === 'android' && USChatMediaSessionModule) {
            USChatMediaSessionModule.updatePlaybackState(false, state.position);
          }
          break;
        }
      }
    },

    playTrack: async (track: Track, newQueue?: Track[]) => {
      const state = get();
      const activeQueue = newQueue || state.queue;
      const index = activeQueue.findIndex((t) => t.trackUri === track.trackUri);
      const videoId = extractYouTubeVideoId(track.trackUri);

      set({
        currentTrack: track,
        isPlaying: true,
        position: 0,
        duration: track.duration * 1000,
        queue: activeQueue,
        queueIndex: index !== -1 ? index : 0,
        originalQueue: newQueue ? [...newQueue] : state.originalQueue,
      });

      // 1. Tell WebView IFrame bridge to load and play video
      if (state.bridge && videoId) {
        state.bridge.loadVideo(videoId, 0);
      } else {
        console.warn('[MusicStore] Player bridge not mounted or invalid videoId:', videoId);
      }

      // 2. Sync native lock screen / notification media controls
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
    },

    pauseTrack: async () => {
      const state = get();
      if (state.bridge && state.isPlaying) {
        state.bridge.pause();
        set({ isPlaying: false });
        if (Platform.OS === 'android' && USChatMediaSessionModule) {
          USChatMediaSessionModule.updatePlaybackState(false, state.position);
        }
        get().persistState();
      }
    },

    resumeTrack: async () => {
      const state = get();
      if (state.bridge && !state.isPlaying) {
        state.bridge.play();
        set({ isPlaying: true });
        if (Platform.OS === 'android' && USChatMediaSessionModule) {
          USChatMediaSessionModule.updatePlaybackState(true, state.position);
        }
        get().persistState();
      }
    },

    stopTrack: async () => {
      const state = get();
      if (state.bridge) {
        state.bridge.pause();
        set({ isPlaying: false, position: 0 });
        if (Platform.OS === 'android' && USChatMediaSessionModule) {
          USChatMediaSessionModule.stopMediaSession();
        }
        get().persistState();
      }
    },

    setQueue: (tracks: Track[]) => {
      set({ queue: tracks, originalQueue: [...tracks] });
      get().persistState();
    },

    nextTrack: async () => {
      const state = get();
      if (state.queue.length === 0) return;
      let nextIndex = state.queueIndex + 1;
      if (nextIndex >= state.queue.length) nextIndex = 0;
      const nextSong = state.queue[nextIndex];
      if (nextSong) {
        set({ queueIndex: nextIndex });
        await get().playTrack(nextSong);
      }
    },

    prevTrack: async () => {
      const state = get();
      if (state.queue.length === 0) return;
      let prevIndex = state.queueIndex - 1;
      if (prevIndex < 0) prevIndex = state.queue.length - 1;
      const prevSong = state.queue[prevIndex];
      if (prevSong) {
        set({ queueIndex: prevIndex });
        await get().playTrack(prevSong);
      }
    },

    seek: async (millis: number) => {
      const state = get();
      if (state.bridge) {
        const seconds = Math.floor(millis / 1000);
        state.bridge.seekTo(seconds);
        set({ position: millis });
        if (Platform.OS === 'android' && USChatMediaSessionModule) {
          USChatMediaSessionModule.updatePlaybackState(state.isPlaying, millis);
        }
        get().persistState();
      }
    },

    seekTrack: async (millis: number) => {
      await get().seek(millis);
    },

    toggleLoop: () => {
      const nextLoop = !get().isLooping;
      set({ isLooping: nextLoop });
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

    addToQueue: (track: Track) => {
      const state = get();
      if (!state.queue.some((t) => t.trackUri === track.trackUri)) {
        set({
          queue: [...state.queue, track],
          originalQueue: [...state.originalQueue, track],
        });
        get().persistState();
      }
    },

    removeFromQueue: (trackUri: string) => {
      const state = get();
      set({
        queue: state.queue.filter((t) => t.trackUri !== trackUri),
        originalQueue: state.originalQueue.filter((t) => t.trackUri !== trackUri),
      });
      get().persistState();
    },

    likeTrack: async (track: Track) => {
      try {
        await apiClient.post('/music/like', track);
        set({ likedSongs: [...get().likedSongs, track] });
      } catch (e) {
        console.warn('Failed to like song:', e);
      }
    },

    unlikeTrack: async (trackUri: string) => {
      try {
        await apiClient.delete(`/music/unlike?trackUri=${encodeURIComponent(trackUri)}`);
        set({ likedSongs: get().likedSongs.filter((t) => t.trackUri !== trackUri) });
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
        const snapshot = {
          currentTrack: state.currentTrack,
          queue: state.queue,
          queueIndex: state.queueIndex,
          isLooping: state.isLooping,
          isShuffled: state.isShuffled,
          originalQueue: state.originalQueue,
          position: state.position,
        };
        await AsyncStorage.setItem('@uschat/music_state', JSON.stringify(snapshot));
      } catch (e) {
        console.warn('Failed to save music state:', e);
      }
    },

    initStore: async () => {
      try {
        const raw = await AsyncStorage.getItem('@uschat/music_state');
        if (raw) {
          const saved = JSON.parse(raw);
          set({
            currentTrack: saved.currentTrack || null,
            queue: saved.queue || [],
            queueIndex: saved.queueIndex ?? -1,
            isLooping: !!saved.isLooping,
            isShuffled: !!saved.isShuffled,
            originalQueue: saved.originalQueue || [],
            position: saved.position || 0,
          });
        }
      } catch (e) {
        console.warn('Failed to load music state:', e);
      }
    },
  };
});

// Hardware / Bluetooth / Lock screen notification media actions
if (Platform.OS === 'android') {
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
