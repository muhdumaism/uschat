import React, { useEffect, useState, useRef } from 'react';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat } from 'react-native-reanimated';
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
import { ArrowLeft, Send, Eye, ShieldCheck, Lock, Reply, Trash2, Copy, Edit, Smile, Plus, Mic, Bell, BellOff, Pin, Phone } from 'lucide-react-native';
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
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../../theme/brutalistTheme';
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

const PulsingRecordDot = () => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.3, { duration: 500 }), -1, true);
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Reanimated.View
      style={[
        animStyle,
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#FF3B30',
          marginRight: 8,
        }
      ]}
    />
  );
};

const VoiceRecordingWaveform: React.FC<{ amplitude: any }> = ({ amplitude }) => {
  const bars = Array.from({ length: 15 }, (_, i) => i);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 10 }}>
      {bars.map((index) => {
        const animatedStyle = useAnimatedStyle(() => {
          const scale = 0.3 + 0.7 * Math.sin((index / 14) * Math.PI);
          const heightVal = Math.max(4, amplitude.value * 35 * scale);
          return {
            height: withTiming(heightVal, { duration: 80 }),
          };
        });
        return (
          <Reanimated.View
            key={index}
            style={[
              animatedStyle,
              {
                width: 3,
                backgroundColor: '#FF3B30',
                marginHorizontal: 1.5,
                borderRadius: 1.5,
              }
            ]}
          />
        );
      })}
    </View>
  );
};

export const ChatScreen: React.FC<any> = ({ route, navigation }) => {
  const { colors, isDarkMode } = useBrutalistTheme();
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

  const { messages, fetchMessages, sendMessage, editMessage, deleteMessage, reactToMessage, chats, fetchChats } = useChatStore();
  const currentUser = useAuthStore((s) => s.user);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const amplitude = useSharedValue(0.1);

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
            const normalized = Math.max(0.1, 1 + db / 60);
            amplitude.value = normalized;
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
        const options: any = {
          messageType: 'VOICE',
          attachments: [{
            fileUrl: uploadRes.fileUrl,
            fileType: uploadRes.fileType || 'audio/mp4',
            fileSizeBytes: uploadRes.fileSizeBytes || 0,
            encryptedKey: '',
            initializationVector: '',
            width: null,
            height: null,
            duration: uploadRes.duration || durationSecs || 1,
            thumbnailUrl: null,
            blurHash: null,
          }]
        };
        await sendMessage(chatId, payloadString, options);
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
        bio: currentUser?.bio || 'Your profile.',
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
        bio: 'Private chat.',
      });
      setShowProfileModal(true);
    }
  };

  const chatItem = chats.find((c) => c.id === chatId);
  const isGroup = chatItem ? chatItem.type === 'GROUP' : false;

  const resolvedDetails = React.useMemo(() => {
    if (!chatItem) {
      return {
        displayName: name || 'Chat',
        username: peerUsername || undefined,
        avatar: undefined,
      };
    }
    if (chatItem.type === 'GROUP') {
      return {
        displayName: chatItem.name,
        username: undefined,
        avatar: chatItem.avatar,
      };
    } else {
      const otherMember = chatItem.members?.find((m: any) => m.user?.id !== currentUser?.id);
      const peer = otherMember?.user;
      return {
        displayName: peer?.displayName || peer?.username || chatItem.name,
        username: peer?.username,
        avatar: peer?.avatarUrl,
      };
    }
  }, [chatItem, name, peerUsername, currentUser]);

  const handleHeaderPress = () => {
    if (isGroup) {
      navigation.navigate('GroupSettings', { chatId, groupName: resolvedDetails.displayName });
    } else {
      handleOpenProfile();
    }
  };

  const handleVoiceCall = async () => {
    if (isGroup) {
      Alert.alert('Group Calls', 'Group voice calling is currently not supported.');
      return;
    }
    const recipient = chatItem?.members?.find((m: any) => m.user?.id !== currentUser?.id)?.user;
    if (!recipient) {
      Alert.alert('Error', 'Unable to initiate call. Recipient not found.');
      return;
    }
    await useCallStore.getState().initiateCall(chatId, recipient.id, recipient.displayName || recipient.username);
  };

  useEffect(() => {
    if (!chatItem) {
      fetchChats();
    }
  }, [chatId, chatItem]);

  useEffect(() => {
    fetchMessages(chatId);
    hasInitialScroll.current = false;

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

      console.log('[Media] Compressing image to optimize storage:', uri, 'Size:', ((info as any).size / 1024).toFixed(0), 'KB');
      
      const compressedResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.WEBP }
      );

      const compInfo = await FileSystem.getInfoAsync(compressedResult.uri);
      console.log('[Media] WebP compressed size:', ((compInfo as any).size / 1024).toFixed(0), 'KB');

      if ((compInfo as any).size > uploadLimits.image) {
        const secondResult = await ImageManipulator.manipulateAsync(
          compressedResult.uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.WEBP }
        );
        const compInfo2 = await FileSystem.getInfoAsync(secondResult.uri);
        if ((compInfo2 as any).size > uploadLimits.image) {
          Alert.alert('Oversized Image', 'Image is too large and cannot be compressed below the limit.');
          return null;
        }
        return secondResult.uri;
      }

      return compressedResult.uri;
    } catch (err: any) {
      console.error('[Media] Image compression failed:', err.message);
      return uri;
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

            const options: any = {
              viewOnce: isViewOnce,
              messageType: 'IMAGE',
              attachments: [{
                fileUrl: res.fileUrl,
                fileType: res.fileType || 'image/webp',
                fileSizeBytes: res.fileSizeBytes || 0,
                encryptedKey: '',
                initializationVector: '',
                width: res.width,
                height: res.height,
                duration: res.duration,
                thumbnailUrl: res.thumbnailUrl,
                blurHash: res.blurHash,
              }]
            };
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Top Phone Status Bar Notch Clearance Spacer */}
      <View style={[styles.statusBarSpacer, { backgroundColor: colors.background }]} />

      <View style={[styles.header, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.yellow }]}>
          <ArrowLeft size={22} color="#000000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleHeaderPress} style={styles.headerProfile}>
          <Avatar uri={resolvedDetails.avatar} name={resolvedDetails.displayName} size={38} />
          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerName, { color: colors.textPrimary }]}>{resolvedDetails.displayName}</Text>
            {resolvedDetails.username && <Text style={[styles.headerHandle, { color: colors.textSecondary }]}>@{resolvedDetails.username}</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {!isGroup && (
            <TouchableOpacity onPress={handleVoiceCall} style={[styles.headerIcon, { backgroundColor: colors.cardBg, borderColor: colors.border, marginRight: 8 }]}>
              <Phone size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={toggleMuteChat} style={[styles.headerIcon, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            {isChatMuted ? (
              <BellOff size={18} color="#FF3B30" />
            ) : (
              <Bell size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenProfile} style={[styles.headerIcon, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <ShieldCheck size={20} color={isDarkMode ? colors.green : '#000000'} />
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
          <View style={[styles.inputBarContainer, { backgroundColor: colors.background, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}>
            <View style={[styles.pillContainer, { backgroundColor: colors.cardBg, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', flex: 1, paddingVertical: 4 }]}>
              <PulsingRecordDot />
              <Text style={[styles.recordingText, { color: colors.textPrimary, marginRight: 10 }]}>{formatDuration(recordingDuration)}</Text>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <VoiceRecordingWaveform amplitude={amplitude} />
              </View>
              <TouchableOpacity onPress={cancelRecording} style={styles.recordingCancelBtn}>
                <Text style={[styles.recordingCancelText, { color: colors.textSecondary, fontWeight: '900' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={finishRecording} style={[styles.actionBtn, styles.micBtnActive, { borderColor: colors.border, backgroundColor: colors.green, marginLeft: 8 }]}>
              <Send size={18} color="#000" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.inputBarContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            {isUploadingVoice && (
              <ActivityIndicator size="small" color={colors.textPrimary} style={{ marginRight: 8 }} />
            )}
            
            <TouchableOpacity
              onPress={() => setShowAttachmentSheet(true)}
              style={[styles.plusBtn, { borderColor: colors.border }]}
            >
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>

            <View style={[styles.pillContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <TextInput
                placeholder={peerUsername ? `Message @${name}` : 'Message'}
                placeholderTextColor={isDarkMode ? '#666666' : '#888888'}
                value={inputText}
                onChangeText={setInputText}
                style={[styles.textInput, { color: colors.textPrimary }]}
              />

              <TouchableOpacity
                onPress={() => setShowEmojiPicker(true)}
                style={styles.smileBtn}
              >
                <Smile size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
            </View>

            {inputText.trim().length > 0 ? (
              <TouchableOpacity onPress={handleSend} style={[styles.actionBtn, { borderColor: colors.border }]}>
                <Send size={18} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={startRecording}
                style={[styles.actionBtn, { borderColor: colors.border }]}
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
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setSelectedMessage(null)}
        >
          <View style={{ backgroundColor: colors.cardBg, borderTopWidth: 4, borderTopColor: colors.border, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}>
            {/* Quick Emoji Reactions */}
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '900', marginBottom: 12, fontFamily: BRUTALIST_STYLES.fontBold }}>REACTIONS</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={async () => {
                    const msg = selectedMessage;
                    setSelectedMessage(null);
                    await reactToMessage(msg.id, chatId, emoji);
                  }}
                  style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.yellow, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 3, backgroundColor: colors.border, marginBottom: 16 }} />

            {/* Reply */}
            <TouchableOpacity
              onPress={() => {
                const msg = selectedMessage;
                setSelectedMessage(null);
                setReplyingToMessage(msg);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
            >
              <Reply size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} style={{ marginRight: 12 }} />
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '900', fontFamily: BRUTALIST_STYLES.fontBold }}>REPLY</Text>
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
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
              >
                <Copy size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} style={{ marginRight: 12 }} />
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '900', fontFamily: BRUTALIST_STYLES.fontBold }}>COPY TEXT</Text>
              </TouchableOpacity>
            )}

            {/* Edit */}
            {selectedMessage?.senderId === currentUser?.id && selectedMessage?.messageType !== 'IMAGE' && !selectedMessage?.viewOnce && (
              <TouchableOpacity
                onPress={() => {
                  const msg = selectedMessage;
                  setSelectedMessage(null);
                  setEditingMessageId(msg.id);
                  setInputText(msg.decryptedText || msg.encryptedContent);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
              >
                <Edit size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} style={{ marginRight: 12 }} />
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '900', fontFamily: BRUTALIST_STYLES.fontBold }}>EDIT MESSAGE</Text>
              </TouchableOpacity>
            )}

            {/* Delete */}
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
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
              >
                <Trash2 size={20} color={colors.red} style={{ marginRight: 12 }} />
                <Text style={{ color: colors.red, fontSize: 14, fontWeight: '900', fontFamily: BRUTALIST_STYLES.fontBold }}>DELETE FOR EVERYONE</Text>
              </TouchableOpacity>
            )}

            {/* Pin Message */}
            {isGroup && (
              <TouchableOpacity
                onPress={async () => {
                  const msg = selectedMessage;
                  setSelectedMessage(null);
                  try {
                    const res = await apiClient.post(`/chats/group/${chatId}/pin/${msg.id}`);
                    Alert.alert(res.data.isPinned ? 'MESSAGE PINNED' : 'MESSAGE UNPINNED', 'ACTION COMPLETED.');
                  } catch (e) {
                    Alert.alert('ERROR', 'FAILED TO TOGGLE PIN STATE.');
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
              >
                <Pin size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} style={{ marginRight: 12 }} />
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '900', fontFamily: BRUTALIST_STYLES.fontBold }}>
                  {selectedMessage?.isPinned ? 'UNPIN MESSAGE' : 'PIN MESSAGE'}
                </Text>
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
    backgroundColor: '#FFFFFF',
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 44 : 20,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: BRUTALIST_STYLES.borderWidth,
    borderColor: '#000000',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: BRUTALIST_COLORS.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
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
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  headerHandle: {
    color: '#555555',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    borderRadius: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRUTALIST_COLORS.yellow,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderColor: '#000000',
  },
  bannerText: {
    color: '#000000',
    fontSize: 9,
    marginLeft: 6,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: BRUTALIST_STYLES.borderWidth,
    borderTopColor: '#000000',
  },
  pillContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
    borderWidth: BRUTALIST_STYLES.borderWidthThin,
    borderColor: '#000000',
    paddingHorizontal: 12,
    height: 44,
    marginRight: 8,
  },
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: BRUTALIST_COLORS.pink,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#000000',
    fontSize: 13,
    height: '100%',
    paddingVertical: 0,
    margin: 0,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  smileBtn: {
    padding: 4,
    marginLeft: 4,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: BRUTALIST_COLORS.yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnActive: {
    backgroundColor: BRUTALIST_COLORS.red,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRUTALIST_COLORS.red,
    marginRight: 8,
  },
  recordingText: {
    color: BRUTALIST_COLORS.red,
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
    flex: 1,
  },
  recordingCancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  recordingCancelText: {
    color: '#555555',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  uploadProgressBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRUTALIST_COLORS.blue,
    borderTopWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  uploadProgressText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  uploadCancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  uploadCancelText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    textDecorationLine: 'underline',
  },
});
