import { create } from 'zustand';
import { apiClient } from '../api/client';
import { SignalEngine } from '../crypto/signalEngine';
import { WebSocketClient } from '../api/wsClient';
import { NativeModules, Platform } from 'react-native';
import { useAuthStore } from './authStore';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  sender: { id: string; username: string; displayName: string; avatarUrl?: string };
  encryptedContent: string;
  decryptedText?: string;
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'VOICE' | 'FILE' | 'CALL_LOG';
  viewOnce: boolean;
  isViewed: boolean;
  replyToId?: string;
  replyTo?: any;
  attachments?: any[];
  createdAt: string;
  isDeletedForEveryone?: boolean;
  reactions?: Array<{ userId: string; username: string; emoji: string }>;
}

export interface ChatItem {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name: string;
  avatar?: string;
  peerUsername?: string;
  isMuted: boolean;
  isArchived: boolean;
  lastMessage?: any;
  updatedAt: string;
  members: any[];
}

interface ChatState {
  chats: ChatItem[];
  activeChatId: string | null;
  messages: Record<string, ChatMessage[]>;
  typingUsers: Record<string, Set<string>>;
  onlineUsers: Set<string>;
  fetchChats: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (
    chatId: string,
    text: string,
    options?: { viewOnce?: boolean; ephemeralDuration?: number; replyToId?: string }
  ) => Promise<void>;
  editMessage: (messageId: string, chatId: string, newText: string) => Promise<void>;
  deleteMessage: (messageId: string, chatId: string) => Promise<void>;
  reactToMessage: (messageId: string, chatId: string, emoji: string) => Promise<void>;
  setActiveChat: (chatId: string | null) => void;
  initWsListeners: () => void;
  wsListenersInitialized: boolean;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  typingUsers: {},
  onlineUsers: new Set(),
  wsListenersInitialized: false,

  fetchChats: async () => {
    try {
      const res = await apiClient.get('/chats');
      set({ chats: res.data });
    } catch (err) {
      console.error('Fetch chats error:', err);
    }
  },

  fetchMessages: async (chatId: string) => {
    try {
      const res = await apiClient.get(`/messages/${chatId}`);
      const rawMsgs: ChatMessage[] = res.data;

      const decrypted = await Promise.all(
        rawMsgs.map(async (msg) => {
          let decryptedReply = undefined;
          if (msg.replyTo) {
            decryptedReply = {
              ...msg.replyTo,
              decryptedText: await SignalEngine.decryptMessage(msg.replyTo.encryptedContent, msg.chatId),
            };
          }
          let parsedReactions = [];
          if (msg.reactions) {
            try {
              parsedReactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions as any) : msg.reactions;
            } catch {
              parsedReactions = [];
            }
          }
          return {
            ...msg,
            decryptedText: await SignalEngine.decryptMessage(msg.encryptedContent, msg.chatId),
            replyTo: decryptedReply || msg.replyTo,
            reactions: parsedReactions,
          };
        })
      );

      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: decrypted,
        },
      }));
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  },

  sendMessage: async (chatId, text, options) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const currentUser = useAuthStore.getState().user;
    const isImageUrl = text.startsWith('http://') || text.startsWith('https://');
    const msgType = (options as any)?.messageType || (isImageUrl ? 'IMAGE' : 'TEXT');

    let replyToObj = undefined;
    if (options?.replyToId) {
      const chatMsgs = get().messages[chatId] || [];
      replyToObj = chatMsgs.find(m => m.id === options.replyToId);
    }

    const optimisticMsg: ChatMessage = {
      id: tempId,
      chatId,
      senderId: currentUser?.id || 'self',
      sender: {
        id: currentUser?.id || 'self',
        username: currentUser?.username || 'self',
        displayName: currentUser?.displayName || 'Self',
        avatarUrl: currentUser?.avatarUrl,
      },
      encryptedContent: '',
      decryptedText: text,
      messageType: msgType,
      viewOnce: options?.viewOnce || false,
      isViewed: false,
      replyToId: options?.replyToId,
      replyTo: replyToObj,
      createdAt: new Date().toISOString(),
      reactions: [],
    };

    // Update state immediately
    set((state) => {
      const existing = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: [...existing, optimisticMsg],
        },
      };
    });

    try {
      const encrypted = await SignalEngine.encryptMessage(text, chatId);

      const res = await apiClient.post('/messages/send', {
        chatId,
        encryptedContent: encrypted.cipherText,
        nonce: encrypted.nonce,
        messageType: msgType,
        ephemeralDuration: options?.ephemeralDuration || 0,
        viewOnce: options?.viewOnce || false,
        replyToId: options?.replyToId,
        attachments: (options as any)?.attachments,
      });

      const parsedReactions = (() => {
        try { return JSON.parse(res.data.reactions || '[]'); } catch { return []; }
      })();

      const newMsg: ChatMessage = {
        ...res.data,
        decryptedText: text,
        reactions: parsedReactions,
      };

      set((state) => {
        const existing = state.messages[chatId] || [];
        const updated = existing.map((m) => (m.id === tempId ? newMsg : m));
        return {
          messages: {
            ...state.messages,
            [chatId]: updated,
          },
        };
      });
    } catch (err) {
      console.error('Send message error:', err);
      // Rollback: remove temporary optimistic message
      set((state) => {
        const existing = state.messages[chatId] || [];
        return {
          messages: {
            ...state.messages,
            [chatId]: existing.filter((m) => m.id !== tempId),
          },
        };
      });
    }
  },

  editMessage: async (messageId, chatId, newText) => {
    let previousMessages: ChatMessage[] = [];
    set((state) => {
      const list = state.messages[chatId] || [];
      previousMessages = list;
      const updatedList = list.map((m) =>
        m.id === messageId ? { ...m, decryptedText: newText } : m
      );
      return {
        messages: {
          ...state.messages,
          [chatId]: updatedList,
        },
      };
    });

    try {
      const encrypted = await SignalEngine.encryptMessage(newText, chatId);
      await apiClient.patch(`/messages/${messageId}/edit`, {
        newContent: encrypted.cipherText,
      });
    } catch (err) {
      console.error('Edit message error:', err);
      // Rollback
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: previousMessages,
        },
      }));
    }
  },

  deleteMessage: async (messageId, chatId) => {
    let previousMessages: ChatMessage[] = [];
    set((state) => {
      const list = state.messages[chatId] || [];
      previousMessages = list;
      const updatedList = list.map((m) =>
        m.id === messageId
          ? {
              ...m,
              isDeletedForEveryone: true,
              encryptedContent: '[DELETED_MESSAGE]',
              decryptedText: 'This message was deleted',
            }
          : m
      );
      return {
        messages: {
          ...state.messages,
          [chatId]: updatedList,
        },
      };
    });

    try {
      await apiClient.delete(`/messages/${messageId}/everyone`);
    } catch (err) {
      console.error('Delete message error:', err);
      // Rollback
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: previousMessages,
        },
      }));
    }
  },

  reactToMessage: async (messageId, chatId, emoji) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    let previousMessages: ChatMessage[] = [];
    set((state) => {
      const list = state.messages[chatId] || [];
      previousMessages = list;
      const updatedList = list.map((m) => {
        if (m.id !== messageId) return m;

        const currentReactions = m.reactions || [];
        const userReactIndex = currentReactions.findIndex((r) => r.userId === currentUser.id);
        let updatedReactions = [...currentReactions];

        if (userReactIndex !== -1) {
          if (currentReactions[userReactIndex].emoji === emoji) {
            updatedReactions.splice(userReactIndex, 1);
          } else {
            updatedReactions[userReactIndex] = {
              userId: currentUser.id,
              username: currentUser.username,
              emoji,
            };
          }
        } else {
          updatedReactions.push({
            userId: currentUser.id,
            username: currentUser.username,
            emoji,
          });
        }

        return { ...m, reactions: updatedReactions };
      });

      return {
        messages: {
          ...state.messages,
          [chatId]: updatedList,
        },
      };
    });

    try {
      const res = await apiClient.post(`/messages/${messageId}/react`, { emoji });
      set((state) => {
        const list = state.messages[chatId] || [];
        const updatedList = list.map((m) =>
          m.id === messageId ? { ...m, reactions: res.data.reactions } : m
        );
        return {
          messages: {
            ...state.messages,
            [chatId]: updatedList,
          },
        };
      });
    } catch (err) {
      console.error('React to message error:', err);
      // Rollback
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: previousMessages,
        },
      }));
    }
  },

  setActiveChat: (chatId) => {
    set({ activeChatId: chatId });
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      try {
        NativeModules.USChatModule.setActiveChatId(chatId);
      } catch (err) {}
    }
  },

  initWsListeners: () => {
    if (get().wsListenersInitialized) return;
    set({ wsListenersInitialized: true });

    WebSocketClient.addListener(async (event, payload) => {
      if (event === 'CALL_OFFER') {
        const { useCallStore } = require('./callStore');
        useCallStore.getState().receiveCall(payload.callerId, payload.callerName, payload.sdp, payload.chatId);
        return;
      } else if (event === 'CALL_ANSWER') {
        const { useCallStore } = require('./callStore');
        useCallStore.getState().handleAnswer(payload.sdp);
        return;
      } else if (event === 'ICE_CANDIDATE') {
        const { useCallStore } = require('./callStore');
        useCallStore.getState().handleIceCandidate(payload.candidate);
        return;
      } else if (event === 'CALL_RINGING') {
        const { useCallStore } = require('./callStore');
        useCallStore.setState({ status: 'ringing' });
        return;
      } else if (event === 'CALL_REJECT' || event === 'CALL_HANGUP') {
        const { useCallStore } = require('./callStore');
        useCallStore.getState().cleanUp();
        return;
      }

      if (event === 'NEW_MESSAGE') {
        const msg: ChatMessage = payload;
        msg.decryptedText = await SignalEngine.decryptMessage(msg.encryptedContent, msg.chatId);
        if (msg.replyTo) {
          msg.replyTo.decryptedText = await SignalEngine.decryptMessage(msg.replyTo.encryptedContent, msg.chatId);
        }
        let parsedReactions = [];
        if (msg.reactions) {
          try {
            parsedReactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions as any) : msg.reactions;
          } catch {
            parsedReactions = [];
          }
        }
        msg.reactions = parsedReactions;

        set((state) => {
          const list = state.messages[msg.chatId] || [];
          const exists = list.some((m) => m.id === msg.id);
          if (exists) return state;
          return {
            messages: {
              ...state.messages,
              [msg.chatId]: [...list, msg],
            },
          };
        });
      } else if (event === 'MESSAGE_EDITED') {
        const msg: ChatMessage = payload;
        msg.decryptedText = await SignalEngine.decryptMessage(msg.encryptedContent, msg.chatId);
        let parsedReactions = [];
        if (msg.reactions) {
          try {
            parsedReactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions as any) : msg.reactions;
          } catch {
            parsedReactions = [];
          }
        }
        msg.reactions = parsedReactions;

        set((state) => {
          const list = state.messages[msg.chatId] || [];
          const updatedList = list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
          return {
            messages: {
              ...state.messages,
              [msg.chatId]: updatedList,
            },
          };
        });
      } else if (event === 'MESSAGE_DELETED') {
        const { messageId, chatId } = payload;
        set((state) => {
          const list = state.messages[chatId] || [];
          const updatedList = list.map((m) =>
            m.id === messageId
              ? { ...m, isDeletedForEveryone: true, encryptedContent: '[DELETED_MESSAGE]', decryptedText: 'This message was deleted' }
              : m
          );
          return {
            messages: {
              ...state.messages,
              [chatId]: updatedList,
            },
          };
        });
      } else if (event === 'MESSAGE_REACTED') {
        const { messageId, chatId, reactions } = payload;
        set((state) => {
          const list = state.messages[chatId] || [];
          const updatedList = list.map((m) =>
            m.id === messageId
              ? { ...m, reactions }
              : m
          );
          return {
            messages: {
              ...state.messages,
              [chatId]: updatedList,
            },
          };
        });
      } else if (event === 'READ_RECEIPT') {
        const { chatId, userId } = payload;
        set((state) => {
          const list = state.messages[chatId] || [];
          const updatedList = list.map((m) =>
            m.senderId !== userId ? { ...m, isViewed: true } : m
          );
          return {
            messages: {
              ...state.messages,
              [chatId]: updatedList,
            },
          };
        });
      } else if (event === 'TYPING_START') {
        set((state) => {
          const setUsers = new Set(state.typingUsers[payload.chatId] || []);
          setUsers.add(payload.userId);
          return { typingUsers: { ...state.typingUsers, [payload.chatId]: setUsers } };
        });
      } else if (event === 'TYPING_STOP') {
        set((state) => {
          const setUsers = new Set(state.typingUsers[payload.chatId] || []);
          setUsers.delete(payload.userId);
          return { typingUsers: { ...state.typingUsers, [payload.chatId]: setUsers } };
        });
      } else if (event === 'USER_STATUS_CHANGE') {
        set((state) => {
          const updated = new Set(state.onlineUsers);
          if (payload.isOnline) {
            updated.add(payload.userId);
          } else {
            updated.delete(payload.userId);
          }
          return { onlineUsers: updated };
        });
      }
    });
  },
}));
