import { create } from 'zustand';

export interface ActiveCall {
  callId: string;
  chatId: string;
  roomName: string;
  livekitToken: string;
  wsUrl: string;
  type: 'AUDIO';
  isMuted: boolean;
  isConnected: boolean;
  peerName?: string;
}

interface CallState {
  activeCall: ActiveCall | null;
  incomingCall: any | null;
  startCall: (call: ActiveCall) => void;
  setIncomingCall: (call: any | null) => void;
  setCallConnected: () => void;
  toggleMute: () => void;
  endCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  incomingCall: null,

  startCall: (call) => set({ activeCall: call, incomingCall: null }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setCallConnected: () =>
    set((state) =>
      state.activeCall
        ? { activeCall: { ...state.activeCall, isConnected: true } }
        : state
    ),
  toggleMute: () =>
    set((state) =>
      state.activeCall
        ? { activeCall: { ...state.activeCall, isMuted: !state.activeCall.isMuted } }
        : state
    ),
  endCall: () => set({ activeCall: null, incomingCall: null }),
}));
