import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Modal,
  Clipboard,
  NativeModules,
} from 'react-native';
import { ArrowLeft, Phone, Send, Eye, ShieldCheck, Lock, Paperclip, Reply, Trash2, Copy, Edit } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MessageBubble } from '../../components/MessageBubble';
import { Avatar } from '../../components/Avatar';
import { UserProfileModal } from '../../components/UserProfileModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { ImagePreviewModal } from '../../components/ImagePreviewModal';
import { requestCallPermissions } from '../../components/IncomingCallModal';
import { COLORS } from '../../theme/colors';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { apiClient } from '../../api/client';
import { API_BASE_URL } from '../../api/config';
import { WebSocketClient } from '../../api/wsClient';

const getReplyText = (msg: any) => {
  if (!msg) return '';
  switch (msg.messageType) {
    case 'IMAGE': return '📷 Photo';
    case 'VIDEO': return '🎥 Video';
    case 'FILE': return '📄 Document';
    case 'VOICE': return '🎤 Voice message';
    case 'CALL_LOG': return '📞 Call';
    default: return msg.decryptedText || msg.encryptedContent || '';
  }
};

export const ChatScreen: React.FC<any> = ({ route, navigation }) => {
  const { chatId, name, peerUsername } = route.params;
  const [inputText, setInputText] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  // Fullscreen Image Modal State
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [isViewingOnce, setIsViewingOnce] = useState(false);
  const [viewingMsgId, setViewingMsgId] = useState<string | null>(null);

  // WhatsApp-like Image Preview / Editing Modal State
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  // Message interaction States
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const { messages, fetchMessages, sendMessage, editMessage, deleteMessage, reactToMessage } = useChatStore();
  const currentUser = useAuthStore((s) => s.user);
  const startCall = useCallStore((s) => s.startCall);

  const chatMessages = (messages[chatId] || []).filter(
    (msg) => !msg.isDeletedForEveryone && msg.encryptedContent !== '[DELETED_MESSAGE]'
  );

  const flatListRef = useRef<FlatList>(null);
  const hasInitialScroll = useRef(false);

  const scrollToBottom = (animated = false) => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
        hasInitialScroll.current = true;
      }, 150);
    }
  };
  
  const handleOpenProfile = async () => {
    if (!peerUsername) {
      setProfileData({
        username: currentUser?.username || 'self',
        displayName: currentUser?.displayName || 'SAVED MESSAGES',
        bio: currentUser?.bio || 'YOUR SECURED MEMORY STORAGE CELL.',
        avatarUrl: currentUser?.avatarUrl,
      });
      setShowProfileModal(true);
      return;
    }

    try {
      const res = await apiClient.get(`/users/by-username/${peerUsername}`);
      setProfileData(res.data);
      setShowProfileModal(true);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setProfileData({
        username: peerUsername,
        displayName: name,
        bio: 'E2EE ROUTED IDENTITY CHANNEL.',
      });
      setShowProfileModal(true);
    }
  };

  useEffect(() => {
    fetchMessages(chatId);
    hasInitialScroll.current = false;

    // Notify websocket and native code that we opened this chat
    WebSocketClient.send('CHAT_OPENED', { chatId });
    WebSocketClient.send('READ_RECEIPT', { chatId });
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      try {
        NativeModules.USChatModule.setActiveChatId(chatId);
      } catch (err) {}
    }

    return () => {
      WebSocketClient.send('CHAT_CLOSED', { chatId });
      if (Platform.OS === 'android' && NativeModules.USChatModule) {
        try {
          NativeModules.USChatModule.setActiveChatId(null);
        } catch (err) {}
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      WebSocketClient.send('READ_RECEIPT', { chatId });
      if (hasInitialScroll.current) {
        scrollToBottom(true);
      } else {
        scrollToBottom(false);
      }
    }
  }, [chatMessages.length]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText;
    setInputText('');
    if (editingMessageId) {
      const msgId = editingMessageId;
      setEditingMessageId(null);
      await editMessage(msgId, chatId, textToSend);
    } else {
      const options: any = { viewOnce: isViewOnce };
      if (replyingToMessage) {
        options.replyToId = replyingToMessage.id;
        setReplyingToMessage(null);
      }
      await sendMessage(chatId, textToSend, options);
      setIsViewOnce(false);
      scrollToBottom(true);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access gallery is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setPreviewImageUri(result.assets[0].uri);
      }
    } catch (err: any) {
      console.error('Image pick error:', err);
    }
  };

  const handleSendImage = async (uri: string, caption?: string) => {
    try {
      let imageUri = uri;

      // Compress and resize image to bypass server 1MB size limits
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        imageUri = manipResult.uri;
      } catch (manipErr) {
        console.warn('Image manipulation failed, using original image:', manipErr);
      }

      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      const token = useAuthStore.getState().token;

      const response = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const rawText = await response.text();
      let uploadRes: any;
      try {
        uploadRes = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('Upload JSON parse error:', parseErr, 'Raw response:', rawText);
        Alert.alert('Upload Failed', `Server responded with status ${response.status}. Response: ${rawText.substring(0, 150)}`);
        return;
      }

      if (uploadRes?.fileUrl) {
        const options: any = { viewOnce: isViewOnce, messageType: 'IMAGE' };
        if (replyingToMessage) {
          options.replyToId = replyingToMessage.id;
          setReplyingToMessage(null);
        }
        await sendMessage(chatId, uploadRes.fileUrl, options);
        setIsViewOnce(false);

        if (caption && caption.trim()) {
          await sendMessage(chatId, caption.trim());
        }

        setPreviewImageUri(null);
        scrollToBottom(true);
      } else {
        Alert.alert('Upload Error', uploadRes?.message || 'Failed to upload photo');
      }
    } catch (err: any) {
      console.error('Image upload error:', err);
      Alert.alert('Upload Error', err.message || 'Failed to upload image');
    }
  };

  const handleInitiateCall = async () => {
    try {
      await requestCallPermissions();

      const res = await apiClient.post('/calls/initiate', { chatId, type: 'AUDIO' });
      startCall({
        callId: res.data.call.id,
        chatId,
        roomName: res.data.call.roomName,
        livekitToken: res.data.livekitToken,
        wsUrl: res.data.wsUrl,
        type: 'AUDIO',
        isMuted: false,
        isConnected: false,
        peerName: name,
      });
      navigation.navigate('CallScreen');
    } catch (err: any) {
      Alert.alert('Call Failed', err.response?.data?.message || 'Unable to initiate call');
    }
  };

  const handleCloseImageViewer = () => {
    if (isViewingOnce && viewingMsgId) {
      apiClient.patch(`/messages/${viewingMsgId}/view-once`);
      fetchMessages(chatId);
    }
    setViewingImageUri(null);
    setIsViewingOnce(false);
    setViewingMsgId(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Phone Status Bar Notch Clearance Spacer */}
      <View style={styles.statusBarSpacer} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleOpenProfile} style={styles.headerProfile}>
          <Avatar name={name} size={38} />
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerName}>{name}</Text>
            {peerUsername && <Text style={styles.headerHandle}>@{peerUsername}</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleOpenProfile} style={styles.headerIcon}>
            <ShieldCheck size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleInitiateCall} style={styles.headerIcon}>
            <Phone size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.banner}>
        <ShieldCheck size={14} color={COLORS.success} />
        <Text style={styles.bannerText}>
          Messages are private and secure.
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={chatMessages}
        style={{ flex: 1 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isMe={item.senderId === currentUser?.id}
            onOpenViewOnce={() => {
              if (!item.isViewed && (item.decryptedText || item.encryptedContent)) {
                setViewingImageUri(item.decryptedText || item.encryptedContent);
                setIsViewingOnce(true);
                setViewingMsgId(item.id);
              }
            }}
            onOpenImage={(uri) => {
              setViewingImageUri(uri);
              setIsViewingOnce(false);
              setViewingMsgId(null);
            }}
            onLongPress={() => {
              if (!item.isDeletedForEveryone) {
                setSelectedMessage(item);
              }
            }}
            onReactPress={async (emoji) => {
              await reactToMessage(item.id, chatId, emoji);
            }}
            onSwipeToReply={setReplyingToMessage}
            onReplyPress={(replyToId) => {
              const index = chatMessages.findIndex((m) => m.id === replyToId);
              if (index !== -1) {
                flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
              }
            }}
          />
        )}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => {
          if (!hasInitialScroll.current && chatMessages.length > 0) {
            scrollToBottom(false);
          }
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {replyingToMessage && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '600' }}>
                Replying to {replyingToMessage.senderId === currentUser?.id ? 'yourself' : `@${replyingToMessage.sender?.username || 'user'}`}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }} numberOfLines={1}>
                {getReplyText(replyingToMessage)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingToMessage(null)}>
              <Text style={{ color: COLORS.textMuted, fontSize: 12, marginLeft: 10 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        {editingMessageId && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>Editing message...</Text>
            <TouchableOpacity onPress={() => { setEditingMessageId(null); setInputText(''); }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBarContainer}>
          <TouchableOpacity
            onPress={() => setIsViewOnce(!isViewOnce)}
            style={[styles.viewOnceBtn, isViewOnce && styles.viewOnceActive]}
          >
            <Eye size={18} color={isViewOnce ? COLORS.primary : COLORS.textMuted} />
          </TouchableOpacity>

          <TextInput
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            style={styles.textInput}
          />

          <TouchableOpacity onPress={handlePickImage} style={styles.attachBtn}>
            <Paperclip size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
            <Send size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen Photo Viewer */}
      <ImageViewerModal
        visible={!!viewingImageUri}
        imageUri={viewingImageUri}
        isViewOnce={isViewingOnce}
        onClose={handleCloseImageViewer}
      />

      <UserProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userData={profileData}
      />

      {/* Bottom Action Sheet for Message Interaction */}
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}
          onPress={() => setSelectedMessage(null)}
        >
          <View style={{ backgroundColor: '#121212', borderTopWidth: 3, borderTopColor: '#FFFFFF', padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, borderRadius: 0 }}>
            {/* Quick Emoji Reactions */}
            <Text style={{ color: '#A1A1AA', fontSize: 11, fontWeight: '900', marginBottom: 12, letterSpacing: 1.5 }}>REACTIONS</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={async () => {
                    const msg = selectedMessage;
                    setSelectedMessage(null);
                    await reactToMessage(msg.id, chatId, emoji);
                  }}
                  style={{ width: 44, height: 44, borderRadius: 0, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 2, backgroundColor: '#FFFFFF', marginBottom: 16 }} />

            {/* Reply */}
            <TouchableOpacity
              onPress={() => {
                const msg = selectedMessage;
                setSelectedMessage(null);
                setReplyingToMessage(msg);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
            >
              <Reply size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>REPLY</Text>
            </TouchableOpacity>

            {/* Copy */}
            {!selectedMessage?.viewOnce && (
              <TouchableOpacity
                onPress={() => {
                  const msg = selectedMessage;
                  setSelectedMessage(null);
                  Clipboard.setString(msg.decryptedText || msg.encryptedContent);
                  Alert.alert('COPIED', 'MESSAGE COPIED TO CLIPBOARD.');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
              >
                <Copy size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>COPY TEXT</Text>
              </TouchableOpacity>
            )}

            {/* Edit (Only if user's own message and not image/view-once) */}
            {selectedMessage?.senderId === currentUser?.id && selectedMessage?.messageType !== 'IMAGE' && !selectedMessage?.viewOnce && (
              <TouchableOpacity
                onPress={() => {
                  const msg = selectedMessage;
                  setSelectedMessage(null);
                  setEditingMessageId(msg.id);
                  setInputText(msg.decryptedText || msg.encryptedContent);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
              >
                <Edit size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>EDIT MESSAGE</Text>
              </TouchableOpacity>
            )}

            {/* Delete (Only if user's own message) */}
            {selectedMessage?.senderId === currentUser?.id && (
              <TouchableOpacity
                onPress={() => {
                  const msg = selectedMessage;
                  setSelectedMessage(null);
                  Alert.alert(
                    'DELETE MESSAGE',
                    'ARE YOU SURE YOU WANT TO DELETE THIS MESSAGE FOR EVERYONE?',
                    [
                      { text: 'CANCEL', style: 'cancel' },
                      {
                        text: 'DELETE',
                        style: 'destructive',
                        onPress: () => deleteMessage(msg.id, chatId),
                      },
                    ]
                  );
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
              >
                <Trash2 size={20} color="#FF0000" style={{ marginRight: 12 }} />
                <Text style={{ color: '#FF0000', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>DELETE FOR EVERYONE</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <ImagePreviewModal
        visible={!!previewImageUri}
        imageUri={previewImageUri}
        onClose={() => setPreviewImageUri(null)}
        onSend={handleSendImage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 52 : 28,
    backgroundColor: '#121212',
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#121212',
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerTitleBox: {
    marginLeft: 12,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerHandle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginLeft: 6,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#121212',
    borderTopWidth: 3,
    borderTopColor: '#FFFFFF',
  },
  viewOnceBtn: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 0,
    backgroundColor: '#000000',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOnceActive: {
    backgroundColor: COLORS.primary,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    maxHeight: 100,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 0,
    backgroundColor: '#000000',
    height: 38,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: COLORS.primary,
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
});
