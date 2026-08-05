import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Eye, Lock, CheckCheck } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { ChatMessage } from '../store/chatStore';

export interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  onOpenViewOnce?: () => void;
  onOpenImage?: (uri: string) => void;
  onLongPress?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  onOpenViewOnce,
  onOpenImage,
  onLongPress,
}) => {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.viewOnce && message.isViewed) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={onLongPress}
        style={[styles.bubble, isMe ? styles.myBubble : styles.peerBubble]}
      >
        <View style={styles.viewOnceBox}>
          <Eye size={16} color={COLORS.textMuted} />
          <Text style={styles.viewOnceOpenedText}>View once photo opened</Text>
        </View>
        <Text style={styles.timeText}>{time}</Text>
      </TouchableOpacity>
    );
  }

  if (message.viewOnce && !message.isViewed) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onOpenViewOnce}
        onLongPress={onLongPress}
        style={[styles.bubble, isMe ? styles.myBubble : styles.peerBubble]}
      >
        <View style={styles.viewOnceBox}>
          <Eye size={18} color={COLORS.primary} />
          <Text style={styles.viewOncePendingText}>1 View Once Photo (Tap to view)</Text>
        </View>
        <Text style={styles.timeText}>{time}</Text>
      </TouchableOpacity>
    );
  }

  const isImage =
    message.messageType === 'IMAGE' ||
    (message.decryptedText &&
      message.decryptedText.startsWith('http') &&
      (message.decryptedText.includes('/uploads/') ||
        message.decryptedText.endsWith('.jpg') ||
        message.decryptedText.endsWith('.png') ||
        message.decryptedText.endsWith('.jpeg')));

  const imageUri = message.decryptedText || message.encryptedContent;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onLongPress={onLongPress}
      style={[styles.bubble, isMe ? styles.myBubble : styles.peerBubble]}
    >
      {isImage ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onOpenImage && onOpenImage(imageUri)}
          onLongPress={onLongPress}
          style={styles.imageContainer}
        >
          <Image source={{ uri: imageUri }} style={styles.attachedImage} resizeMode="cover" />
        </TouchableOpacity>
      ) : (
        <Text style={[styles.messageText, isMe ? styles.myText : styles.peerText]}>
          {message.decryptedText ?? message.encryptedContent}
        </Text>
      )}

      <View style={styles.footerRow}>
        <Lock size={10} color={isMe ? 'rgba(255, 255, 255, 0.6)' : COLORS.textMuted} style={styles.lockIcon} />
        <Text style={[styles.timeText, isMe ? styles.myTime : styles.peerTime]}>{time}</Text>
        {isMe && <CheckCheck size={12} color={COLORS.primary} style={styles.checkIcon} />}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginVertical: 4,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  peerBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myText: {
    color: '#FFF',
  },
  peerText: {
    color: COLORS.textPrimary,
  },
  imageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 4,
  },
  attachedImage: {
    width: 220,
    height: 180,
    borderRadius: 14,
  },
  viewOnceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  viewOncePendingText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  viewOnceOpenedText: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
    fontSize: 13,
    marginLeft: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  lockIcon: {
    marginRight: 4,
  },
  timeText: {
    fontSize: 11,
  },
  myTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  peerTime: {
    color: COLORS.textMuted,
  },
  checkIcon: {
    marginLeft: 4,
  },
});
