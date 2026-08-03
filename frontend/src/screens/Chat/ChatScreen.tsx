import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { ArrowLeft, Phone, Video, Send, Eye, ShieldCheck, Lock, Paperclip } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { MessageBubble } from '../../components/MessageBubble';
import { Avatar } from '../../components/Avatar';
import { SafetyNumberModal } from '../../components/SafetyNumberModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { requestCallPermissions } from '../../components/IncomingCallModal';
import { COLORS } from '../../theme/colors';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { apiClient, API_BASE_URL } from '../../api/client';

export const ChatScreen: React.FC<any> = ({ route, navigation }) => {
  const { chatId, name, peerUsername } = route.params;
  const [inputText, setInputText] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // Fullscreen Image Modal State
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [isViewingOnce, setIsViewingOnce] = useState(false);
  const [viewingMsgId, setViewingMsgId] = useState<string | null>(null);

  const { messages, fetchMessages, sendMessage } = useChatStore();
  const currentUser = useAuthStore((s) => s.user);
  const startCall = useCallStore((s) => s.startCall);

  const chatMessages = messages[chatId] || [];

  useEffect(() => {
    fetchMessages(chatId);
  }, [chatId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText;
    setInputText('');
    await sendMessage(chatId, textToSend, { viewOnce: isViewOnce });
    setIsViewOnce(false);
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
        const imageUri = result.assets[0].uri;

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
        } catch {
          Alert.alert('Upload Failed', 'Unable to upload photo to server. Please try again.');
          return;
        }

        if (uploadRes?.fileUrl) {
          await sendMessage(chatId, uploadRes.fileUrl, { viewOnce: isViewOnce });
          setIsViewOnce(false);
        } else {
          Alert.alert('Upload Error', uploadRes?.message || 'Failed to upload photo');
        }
      }
    } catch (err: any) {
      console.error('Image upload error:', err);
      Alert.alert('Upload Error', err.message || 'Failed to upload image');
    }
  };

  const handleInitiateCall = async (type: 'AUDIO' | 'VIDEO') => {
    try {
      await requestCallPermissions();

      const res = await apiClient.post('/calls/initiate', { chatId, type });
      startCall({
        callId: res.data.call.id,
        chatId,
        roomName: res.data.call.roomName,
        livekitToken: res.data.livekitToken,
        wsUrl: res.data.wsUrl,
        type,
        isMuted: false,
        isVideoOff: type === 'AUDIO',
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

        <TouchableOpacity onPress={() => setShowSafetyModal(true)} style={styles.headerProfile}>
          <Avatar name={name} size={38} />
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerName}>{name}</Text>
            {peerUsername && <Text style={styles.headerHandle}>@{peerUsername}</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowSafetyModal(true)} style={styles.headerIcon}>
            <ShieldCheck size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleInitiateCall('AUDIO')} style={styles.headerIcon}>
            <Phone size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleInitiateCall('VIDEO')} style={styles.headerIcon}>
            <Video size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.banner}>
        <Lock size={12} color={COLORS.accent} />
        <Text style={styles.bannerText}>
          Messages are End-to-End Encrypted.
        </Text>
      </View>

      <FlatList
        data={chatMessages}
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
          />
        )}
        contentContainerStyle={styles.listContent}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputBarContainer}>
          <TouchableOpacity
            onPress={() => setIsViewOnce(!isViewOnce)}
            style={[styles.viewOnceBtn, isViewOnce && styles.viewOnceActive]}
          >
            <Eye size={18} color={isViewOnce ? COLORS.primary : COLORS.textMuted} />
          </TouchableOpacity>

          <TextInput
            placeholder="Encrypted Message..."
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

      {currentUser && (
        <SafetyNumberModal
          visible={showSafetyModal}
          onClose={() => setShowSafetyModal(false)}
          myUserId={currentUser.id}
          peerUserId={peerUsername || chatId}
          peerName={name}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 52 : 28,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 6,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerTitleBox: {
    marginLeft: 10,
  },
  headerName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerHandle: {
    color: COLORS.secondary,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerIcon: {
    padding: 8,
    marginLeft: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  bannerText: {
    color: COLORS.accent,
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.secondaryBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewOnceBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    marginRight: 6,
  },
  viewOnceActive: {
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    maxHeight: 100,
    paddingHorizontal: 12,
  },
  attachBtn: {
    padding: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
});
