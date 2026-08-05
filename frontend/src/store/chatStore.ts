import { create } from 'zustand';
import { apiClient } from '../api/client';
import { SignalEngine } from '../crypto/signalEngine';
import { WebSocketClient } from '../api/wsClient';
import { useCallStore } from './callStore';

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
    try {
      const isImageUrl = text.startsWith('http://') || text.startsWith('https://');
      const msgType = (options as any)?.messageType || (isImageUrl ? 'IMAGE' : 'TEXT');

      const encrypted = await SignalEngine.encryptMessage(text, chatId);

      const res = await apiClient.post('/messages/send', {
        chatId,
        encryptedContent: encrypted.cipherText,
        nonce: encrypted.nonce,
        messageType: msgType,
        ephemeralDuration: options?.ephemeralDuration || 0,
        viewOnce: options?.viewOnce || false,
        replyToId: options?.replyToId,
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
        return {
          messages: {
            ...state.messages,
            [chatId]: [...existing, newMsg],
          },
        };
      });
    } catch (err) {
      console.error('Send message error:', err);
    }
  },

  editMessage: async (messageId, chatId, newText) => {
    const encrypted = await SignalEngine.encryptMessage(newText, chatId);
    const res = await apiClient.patch(`/messages/${messageId}/edit`, {
      newContent: encrypted.cipherText,
    });

    set((state) => {
      const list = state.messages[chatId] || [];
      const updatedList = list.map((m) =>
        m.id === messageId
          ? { ...m, encryptedContent: encrypted.cipherText, decryptedText: newText }
          : m
      );
      return {
        messages: {
          ...state.messages,
          [chatId]: updatedList,
        },
      };
    });
  },

  deleteMessage: async (messageId, chatId) => {
    try {
      await apiClient.delete(`/messages/${messageId}/everyone`);
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
    } catch (err) {
      console.error('Delete message error:', err);
    }
  },

  reactToMessage: async (messageId, chatId, emoji) => {
    try {
      const res = await apiClient.post(`/messages/${messageId}/react`, { emoji });
      set((state) => {
        const list = state.messages[chatId] || [];
        const updatedList = list.map((m) =>
          m.id === messageId
            ? { ...m, reactions: res.data.reactions }
            : m
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
    }
  },

  setActiveChat: (chatId) => {
    set({ activeChatId: chatId });
  },

  initWsListeners: () => {
    if (get().wsListenersInitialized) return;
    set({ wsListenersInitialized: true });

    WebSocketClient.addListener(async (event, payload) => {
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
      } else if (event === 'INCOMING_CALL') {
        useCallStore.getState().setIncomingCall(payload);
      } else if (event === 'CALL_ACCEPTED') {
        useCallStore.getState().setCallConnected();
      } else if (event === 'CALL_ENDED') {
        useCallStore.getState().endCall();
      }
    });
  },
}));
