import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { X, RotateCw, Send, Smile } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { EmojiPickerModal } from './EmojiPickerModal';
import { COLORS } from '../theme/colors';

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onSend: (uri: string, caption?: string, isViewOnce?: boolean) => Promise<void>;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUri,
  onClose,
  onSend,
}) => {
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (visible && imageUri) {
      setCurrentUri(imageUri);
      setCaption('');
      setIsViewOnce(false);
      setSending(false);
      setProcessing(false);
    }
  }, [visible, imageUri]);

  if (!visible || !currentUri) return null;

  const handleRotate = async () => {
    if (!currentUri) return;
    try {
      setProcessing(true);
      const result = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ rotate: 90 }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
    } catch (err) {
      console.error('Rotation error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendPress = async () => {
    if (!currentUri) return;
    try {
      setSending(true);
      await onSend(currentUri, caption, isViewOnce);
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <X size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleRotate} style={styles.iconBtn} disabled={processing}>
                {processing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <RotateCw size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Image View */}
          <View style={styles.imageWrapper}>
            <Image source={{ uri: currentUri }} style={styles.previewImage} resizeMode="contain" />
          </View>

          {/* Footer input, view once toggle and send */}
          <View style={styles.footer}>
            <View style={styles.inputContainer}>
              <TouchableOpacity
                onPress={() => setShowEmojiPicker(true)}
                style={styles.emojiBtn}
              >
                <Smile size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={caption}
                onChangeText={setCaption}
                multiline
              />

              <TouchableOpacity
                onPress={() => setIsViewOnce(!isViewOnce)}
                style={[
                  styles.viewOnceBtn,
                  isViewOnce ? styles.viewOnceBtnActive : styles.viewOnceBtnInactive
                ]}
              >
                <Text style={[
                  styles.viewOnceText,
                  isViewOnce ? styles.viewOnceTextActive : styles.viewOnceTextInactive
                ]}>1</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendPress}
                style={styles.sendBtn}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Send size={18} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={(emoji) => setCaption((prev) => prev + emoji)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginLeft: 10,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emojiBtn: {
    padding: 6,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 6,
    paddingRight: 10,
  },
  viewOnceBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  viewOnceBtnInactive: {
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'transparent',
  },
  viewOnceBtnActive: {
    borderColor: '#00E676', // Glowing WhatsApp green
    backgroundColor: '#00E676',
  },
  viewOnceText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  viewOnceTextInactive: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  viewOnceTextActive: {
    color: '#000',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#25D366', // WhatsApp Green
    justifyContent: 'center',
    alignItems: 'center',
  },
});
