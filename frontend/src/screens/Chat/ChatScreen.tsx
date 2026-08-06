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
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Send, Eye, ShieldCheck, Lock, Reply, Trash2, Copy, Edit, Smile, Plus, Mic, Bell, BellOff } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { MessageBubble } from '../../components/MessageBubble';
import { Avatar } from '../../components/Avatar';
import { UserProfileModal } from '../../components/UserProfileModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { ImagePreviewModal } from '../../components/ImagePreviewModal';
import { AttachmentSheet } from '../../components/AttachmentSheet';
import { EmojiPickerModal } from '../../components/EmojiPickerModal';
import { COLORS } from '../../theme/colors';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  // Dynamic upload limits configuration
  const [uploadLimits, setUploadLimits] = useState({
    image: 10 * 1024 * 1024,
    video: 100 * 1024 * 1024,
    voice: 25 * 1024 * 1024,
    document: 50 * 1024 * 1024,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiClient.get('/app/config');
        if (res.data?.uploadLimits) {
          setUploadLimits(res.data.uploadLimits);
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic upload limits config:', err);
      }
    };
    fetchConfig();
  }, []);

  // Upload Progress & State tracker
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const [failedUploadData, setFailedUploadData] = useState<{ uri: string; caption?: string; isViewOnce?: boolean } | null>(null);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  // Chat mute status
  const [isChatMuted, setIsChatMuted] = useState(false);

  const toggleMuteChat = () => {
    const nextState = !isChatMuted;
    setIsChatMuted(nextState);
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      try {
        NativeModules.USChatModule.setBoolPreference(`mute_chat_${chatId}`, nextState);
      } catch (err) {}
    }
    Alert.alert(
      nextState ? 'Chat Muted' : 'Chat Unmuted',
      nextState ? 'Notifications for this chat will be silent.' : 'Notifications for this chat are restored.'
    );
  };

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

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

  // Redesigned overlay states
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone Access Denied', 'Permission to access the microphone is required to record voice messages.');
        return;
      }

      if (recordingInstance) {
        await recordingInstance.stopAndUnloadAsync();
      }

      Vibration.vibrate([0, 80]);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          format: Audio.IOSOutputFormat.MPEG4AAC,
        },
        web: {},
      };

      recording.setOnRecordingStatusUpdate((status) => {
        if (status.canRecord && status.isRecording) {
          setRecordingDuration(Math.floor(status.durationMillis / 1000));
          if (status.metering !== undefined) {
            const db = status.metering;
            const normalized = Math.max(0, 1 + db / 60);
            setRecordingWaveform((prev) => [...prev, normalized]);
          }
        }
      });

      await recording.prepareToRecordAsync({
        ...recordingOptions,
        keepConnectionAlive: true,
      } as any);
      
      await recording.setProgressUpdateInterval(100);
      await recording.startAsync();

      setRecordingInstance(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingWaveform([]);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Recording Failed', 'Could not access audio hardware.');
    }
  };

  const cancelRecording = async () => {
    if (!recordingInstance) return;
    try {
      Vibration.vibrate([0, 40, 40, 40]);
      await recordingInstance.stopAndUnloadAsync();
      setRecordingInstance(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setRecordingWaveform([]);
    } catch (err) {
      console.error('Failed to cancel recording:', err);
    }
  };

  const finishRecording = async () => {
    if (!recordingInstance) return;
    try {
      Vibration.vibrate(50);
      await recordingInstance.stopAndUnloadAsync();
      const uri = recordingInstance.getURI();
      const finalDuration = recordingDuration;
      const finalWaveform = [...recordingWaveform];

      setRecordingInstance(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setRecordingWaveform([]);

      if (!uri) {
        Alert.alert('Recording Error', 'Could not locate the voice message audio path.');
        return;
      }

      uploadVoiceMessage(uri, finalDuration, finalWaveform);
    } catch (err) {
      console.error('Failed to finish recording:', err);
    }
  };

  const uploadVoiceMessage = async (uri: string, durationSecs: number, waveformData: number[]) => {
    setIsUploadingVoice(true);
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && info.size > uploadLimits.voice) {
        const limitMb = (uploadLimits.voice / (1024 * 1024)).toFixed(0);
        Alert.alert('Oversized Audio', `This voice message exceeds the ${limitMb} MB upload limit.`);
        setIsUploadingVoice(false);
        return;
      }

      const formData = new FormData();
      const filename = `voice_${Date.now()}.m4a`;
      formData.append('file', {
        uri,
        name: filename,
        type: 'audio/m4a',
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
      } catch (err) {
        console.error('Voice upload parse error:', err, rawText);
        return;
      }

      if (uploadRes?.fileUrl) {
        const payloadString = JSON.stringify({
          audioUrl: uploadRes.fileUrl,
          duration: durationSecs || 1,
          waveform: waveformData.length > 0 ? waveformData : [0.15, 0.2, 0.15],
        });
        await sendMessage(chatId, payloadString, { messageType: 'VOICE' } as any);
      } else {
        Alert.alert('Upload Error', uploadRes?.message || 'Failed to sync voice message to server.');
      }
    } catch (err: any) {
      console.error('Voice upload error:', err);
      Alert.alert('Network Error', 'Failed to upload voice message.');
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const handleAttachmentOption = (option: string) => {
    switch (option) {
      case 'photos':
        handlePickImage();
        break;
      case 'camera':
        handleLaunchCamera();
        break;
      default:
        Alert.alert('Coming Soon', `${option.toUpperCase()} share option will be available soon.`);
        break;
    }
  };

  const chatMessages = (messages[chatId] || []).filter(
    (msg) => !msg.isDeletedForEveryone && msg.encryptedContent !== '[DELETED_MESSAGE]'
  );

  const flatListRef = useRef<FlatList>(null);
  const hasInitialScroll = useRef(false);

  const scrollToBottom = (animated = false) => {
    if (chatMessages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated });
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

    // Settle initial scroll lock after 1 second to allow layout rendering
    const timer = setTimeout(() => {
      hasInitialScroll.current = true;
    }, 1000);

    // Notify websocket and native code that we opened this chat
    WebSocketClient.send('CHAT_OPENED', { chatId });
    WebSocketClient.send('READ_RECEIPT', { chatId });
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      try {
        NativeModules.USChatModule.setActiveChatId(chatId);
        NativeModules.USChatModule.clearChatNotifications(chatId);
        NativeModules.USChatModule.getBoolPreference(`mute_chat_${chatId}`, false).then(setIsChatMuted);
      } catch (err) {}
    }

    return () => {
      clearTimeout(timer);
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
      const options: any = {};
      if (replyingToMessage) {
        options.replyToId = replyingToMessage.id;
        setReplyingToMessage(null);
      }
      await sendMessage(chatId, textToSend, options);
      scrollToBottom(true);
    }
  };

  const validateAndProcessImage = async (uri: string): Promise<string | null> => {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        Alert.alert('Invalid File', 'This file does not exist or is corrupted.');
        return null;
      }

      const filename = uri.toLowerCase();
      const isSupported = filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png') || filename.endsWith('.webp');
      if (!isSupported) {
        Alert.alert('Unsupported Format', 'Please upload a JPG, JPEG, PNG, or WEBP image.');
        return null;
      }

      if (info.size > uploadLimits.image) {
        const currentSizeMb = (info.size / (1024 * 1024)).toFixed(2);
        const limitSizeMb = (uploadLimits.image / (1024 * 1024)).toFixed(0);
        return new Promise((resolve) => {
          Alert.alert(
            'Oversized Image',
            `This image exceeds the ${limitSizeMb} MB upload limit (Current: ${currentSizeMb} MB).`,
            [
              {
                text: 'Choose Another',
                style: 'cancel',
                onPress: () => resolve(null),
              },
              {
                text: 'Compress & Send',
                onPress: async () => {
                  try {
                    const result = await ImageManipulator.manipulateAsync(
                      uri,
                      [{ resize: { width: 1200 } }],
                      { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
                    );
                    const compInfo = await FileSystem.getInfoAsync(result.uri);
                    if (compInfo.exists && compInfo.size <= uploadLimits.image) {
                      resolve(result.uri);
                    } else {
                      const result2 = await ImageManipulator.manipulateAsync(
                        result.uri,
                        [{ resize: { width: 800 } }],
                        { compress: 0.45, format: ImageManipulator.SaveFormat.JPEG }
                      );
                      resolve(result2.uri);
                    }
                  } catch (compErr) {
                    console.error('Image compression error:', compErr);
                    Alert.alert('Error', 'Failed to compress the selected image.');
                    resolve(null);
                  }
                },
              },
            ]
          );
        });
      }
      return uri;
    } catch (err) {
      console.error('Validation error:', err);
      Alert.alert('Validation Error', 'Failed to inspect file properties.');
      return null;
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
        const originalUri = result.assets[0].uri;
        const processedUri = await validateAndProcessImage(originalUri);
        if (processedUri) {
          setPreviewImageUri(processedUri);
        }
      }
    } catch (err: any) {
      console.error('Image pick error:', err);
    }
  };

  const handleLaunchCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Camera access is required to take photos!');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const originalUri = result.assets[0].uri;
        const processedUri = await validateAndProcessImage(originalUri);
        if (processedUri) {
          setPreviewImageUri(processedUri);
        }
      }
    } catch (err) {
      console.error('Camera launch error:', err);
    }
  };

  const handleSendImage = async (uri: string, caption?: string, isViewOnce = false) => {
    setPreviewImageUri(null);
    setUploadState('uploading');
    setUploadProgress(0);
    setFailedUploadData(null);

    const formData = new FormData();
    const filename = uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri,
      name: filename,
      type,
    } as any);

    const token = useAuthStore.getState().token;
    const xhr = new XMLHttpRequest();
    activeXhrRef.current = xhr;

    xhr.open('POST', `${API_BASE_URL}/media/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentage);
      }
    };

    xhr.onload = async () => {
      activeXhrRef.current = null;
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res?.fileUrl) {
            setUploadState('idle');
            setUploadProgress(null);

            const options: any = { viewOnce: isViewOnce, messageType: 'IMAGE' };
            if (replyingToMessage) {
              options.replyToId = replyingToMessage.id;
              setReplyingToMessage(null);
            }
            await sendMessage(chatId, res.fileUrl, options);
            
            if (caption && caption.trim()) {
              await sendMessage(chatId, caption.trim());
            }
            scrollToBottom(true);
          } else {
            handleUploadFailure(uri, caption, isViewOnce);
          }
        } catch (err) {
          handleUploadFailure(uri, caption, isViewOnce);
        }
      } else {
        handleUploadFailure(uri, caption, isViewOnce);
      }
    };

    xhr.onerror = () => {
      activeXhrRef.current = null;
      handleUploadFailure(uri, caption, isViewOnce);
    };

    xhr.send(formData);
  };

  const handleUploadFailure = (uri: string, caption?: string, isViewOnce = false) => {
    setUploadState('failed');
    setUploadProgress(null);
    setFailedUploadData({ uri, caption, isViewOnce });
    Alert.alert('Upload Failed', 'Failed to upload image. You can retry from the indicator banner.');
  };

  const cancelUpload = () => {
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
    setUploadState('idle');
    setUploadProgress(null);
    setFailedUploadData(null);
  };

  const retryUpload = () => {
    if (failedUploadData) {
      const { uri, caption, isViewOnce } = failedUploadData;
      handleSendImage(uri, caption, isViewOnce);
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
          <TouchableOpacity onPress={toggleMuteChat} style={styles.headerIcon}>
            {isChatMuted ? (
              <BellOff size={18} color="#FF3B30" />
            ) : (
              <Bell size={18} color={COLORS.textPrimary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenProfile} style={styles.headerIcon}>
            <ShieldCheck size={20} color={COLORS.primary} />
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
        {isRecording ? (
          <View style={styles.inputBarContainer}>
            <View style={styles.pillContainer}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording {formatDuration(recordingDuration)}</Text>
              
              <TouchableOpacity onPress={cancelRecording} style={styles.recordingCancelBtn}>
                <Text style={styles.recordingCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={finishRecording} style={[styles.actionBtn, styles.micBtnActive]}>
              <Send size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputBarContainer}>
            {isUploadingVoice && (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
            )}
            
            <TouchableOpacity
              onPress={() => setShowAttachmentSheet(true)}
              style={styles.plusBtn}
            >
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.pillContainer}>
              <TextInput
                placeholder={peerUsername ? `Message @${name}` : 'Message'}
                placeholderTextColor="#888"
                value={inputText}
                onChangeText={setInputText}
                style={styles.textInput}
              />

              <TouchableOpacity
                onPress={() => setShowEmojiPicker(true)}
                style={styles.smileBtn}
              >
                <Smile size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {inputText.trim().length > 0 ? (
              <TouchableOpacity onPress={handleSend} style={styles.actionBtn}>
                <Send size={18} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={startRecording}
                style={styles.actionBtn}
              >
                <Mic size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
        {uploadState === 'uploading' && (
          <View style={styles.uploadProgressBanner}>
            <Text style={styles.uploadProgressText}>
              Uploading Media ({uploadProgress}%)
            </Text>
            <TouchableOpacity onPress={cancelUpload} style={styles.uploadCancelBtn}>
              <Text style={styles.uploadCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        {uploadState === 'failed' && (
          <View style={styles.uploadProgressBanner}>
            <Text style={styles.uploadProgressText}>Upload failed.</Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={retryUpload} style={[styles.uploadCancelBtn, { marginRight: 16 }]}>
                <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelUpload} style={styles.uploadCancelBtn}>
                <Text style={styles.uploadCancelText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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

      <AttachmentSheet
        visible={showAttachmentSheet}
        onClose={() => setShowAttachmentSheet(false)}
        onSelectOption={handleAttachmentOption}
      />

      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={(emoji) => setInputText((prev) => prev + emoji)}
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
    paddingVertical: 10,
    backgroundColor: '#0F0F0F',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  pillContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    paddingHorizontal: 16,
    height: 46,
    marginRight: 10,
  },
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
    margin: 0,
  },
  smileBtn: {
    padding: 6,
    marginLeft: 6,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnActive: {
    backgroundColor: '#E53935',
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53935',
    marginRight: 8,
  },
  recordingText: {
    color: '#E53935',
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  recordingCancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  recordingCancelText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadProgressBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  uploadProgressText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadCancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  uploadCancelText: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
});
