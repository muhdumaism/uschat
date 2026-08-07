import { create } from 'zustand';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices } from 'react-native-webrtc';
import { WebSocketClient } from '../api/wsClient';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface CallState {
  chatId: string | null;
  targetId: string | null;
  targetName: string | null;
  status: 'idle' | 'dialing' | 'ringing' | 'connected' | 'incoming';
  isMuted: boolean;
  isSpeaker: boolean;
  duration: number;
  localStream: any | null;
  remoteStream: any | null;
  peerConnection: RTCPeerConnection | null;
  timerId: any | null;

  initiateCall: (chatId: string, targetId: string, targetName: string) => Promise<void>;
  receiveCall: (callerId: string, callerName: string, sdp: any, chatId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  hangupCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  handleIceCandidate: (candidate: any) => Promise<void>;
  handleAnswer: (sdp: any) => Promise<void>;
  cleanUp: () => void;
}

export const useCallStore = create<CallState>((set, get) => {
  let pendingCandidates: any[] = [];

  const startDurationTimer = () => {
    if (get().timerId) clearInterval(get().timerId);
    const interval = setInterval(() => {
      set((state) => ({ duration: state.duration + 1 }));
    }, 1000);
    set({ timerId: interval });
  };

  const setupWebRTC = async (targetUserId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.addEventListener('icecandidate', (event: any) => {
      if (event.candidate) {
        WebSocketClient.send('ICE_CANDIDATE', {
          targetId: targetUserId,
          candidate: event.candidate,
        });
      }
    });

    pc.addEventListener('track', (event: any) => {
      if (event.streams && event.streams[0]) {
        set({ remoteStream: event.streams[0] });
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC] ICE Connection State changed to:', state);
      if (state === 'connected') {
        set({ status: 'connected' });
        startDurationTimer();
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        get().hangupCall();
      }
    });

    // Request permissions and get local stream
    let localStream: any = null;
    try {
      localStream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      set({ localStream });
      localStream.getTracks().forEach((track: any) => {
        pc.addTrack(track, localStream as any);
      });
    } catch (err) {
      console.warn('[WebRTC] Failed to capture microphone:', err);
    }

    set({ peerConnection: pc });
    return pc;
  };

  return {
    chatId: null,
    targetId: null,
    targetName: null,
    status: 'idle',
    isMuted: false,
    isSpeaker: false,
    duration: 0,
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    timerId: null,

    initiateCall: async (chatId, targetId, targetName) => {
      set({
        chatId,
        targetId,
        targetName,
        status: 'dialing',
        duration: 0,
        isMuted: false,
        isSpeaker: false,
      });

      try {
        const pc = await setupWebRTC(targetId);
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);

        WebSocketClient.send('CALL_OFFER', {
          targetId,
          callerName: targetName,
          sdp: offer,
          chatId,
        });
      } catch (err) {
        console.error('[CallStore] Initiate Call Error:', err);
        get().cleanUp();
      }
    },

    receiveCall: async (callerId, callerName, sdp, chatId) => {
      // If busy, auto-reject
      if (get().status !== 'idle') {
        WebSocketClient.send('CALL_REJECT', { targetId: callerId });
        return;
      }

      set({
        chatId,
        targetId: callerId,
        targetName: callerName,
        status: 'incoming',
        duration: 0,
        isMuted: false,
        isSpeaker: false,
      });

      pendingCandidates = [];

      try {
        const pc = await setupWebRTC(callerId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Flush any candidates received before description was set
        while (pendingCandidates.length > 0) {
          const cand = pendingCandidates.shift();
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }

        WebSocketClient.send('CALL_RINGING', { targetId: callerId });
      } catch (err) {
        console.error('[CallStore] Receive Call Error:', err);
        get().cleanUp();
      }
    },

    acceptCall: async () => {
      const pc = get().peerConnection;
      const targetId = get().targetId;
      if (!pc || !targetId) return;

      try {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        WebSocketClient.send('CALL_ANSWER', {
          targetId,
          sdp: answer,
        });

        set({ status: 'connected' });
        startDurationTimer();
      } catch (err) {
        console.error('[CallStore] Accept Call Error:', err);
        get().hangupCall();
      }
    },

    rejectCall: () => {
      const targetId = get().targetId;
      if (targetId) {
        WebSocketClient.send('CALL_REJECT', { targetId });
      }
      get().cleanUp();
    },

    hangupCall: () => {
      const targetId = get().targetId;
      if (targetId) {
        WebSocketClient.send('CALL_HANGUP', { targetId });
      }
      get().cleanUp();
    },

    toggleMute: () => {
      const { localStream, isMuted } = get();
      if (localStream) {
        localStream.getAudioTracks().forEach((track: any) => {
          track.enabled = isMuted;
        });
        set({ isMuted: !isMuted });
      }
    },

    toggleSpeaker: () => {
      // In react-native-webrtc, speakerphone can be toggled using mediaDevices
      const nextSpeaker = !get().isSpeaker;
      try {
        // Toggle audio output routing via exposed mediaDevices helpers
        (mediaDevices as any).setSpeakerphoneOn(nextSpeaker);
      } catch (err) {
        console.warn('Failed to toggle speakerphone output route:', err);
      }
      set({ isSpeaker: nextSpeaker });
    },

    handleIceCandidate: async (candidate) => {
      const pc = get().peerConnection;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] Failed to add ICE candidate:', err);
        }
      } else {
        pendingCandidates.push(candidate);
      }
    },

    handleAnswer: async (sdp) => {
      const pc = get().peerConnection;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) {
          console.error('[WebRTC] Failed to set remote description answer:', err);
        }
      }
    },

    cleanUp: () => {
      const { peerConnection, localStream, timerId } = get();
      if (timerId) clearInterval(timerId);

      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }

      set({
        chatId: null,
        targetId: null,
        targetName: null,
        status: 'idle',
        duration: 0,
        isMuted: false,
        isSpeaker: false,
        localStream: null,
        remoteStream: null,
        peerConnection: null,
        timerId: null,
      });
    },
  };
});
