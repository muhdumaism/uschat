import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Vibration } from 'react-native';
import { Eye, Lock, CheckCheck, Reply } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { COLORS } from '../theme/colors';
import { ChatMessage } from '../store/chatStore';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { MediaCacheService } from '../services/mediaCacheService';

const CachedImage: React.FC<{ uri: string; style: any; blurHash?: string | null }> = ({ uri, style, blurHash }) => {
  const [sourceUri, setSourceUri] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const resolveUri = async () => {
      const cached = await MediaCacheService.getCachedUri(uri);
      if (isMounted) {
        setSourceUri(cached);
      }
    };
    resolveUri();
    return () => { isMounted = false; };
  }, [uri]);

  if (!sourceUri) {
    if (blurHash) {
      return (
        <Image
          source={{ uri: blurHash }}
          style={style}
          blurRadius={12}
          resizeMode="cover"
        />
      );
    }
    return <View style={[style, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />;
  }

  return <Image source={{ uri: sourceUri }} style={style} resizeMode="cover" />;
};

export interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  onOpenViewOnce?: () => void;
  onOpenImage?: (uri: string) => void;
  onLongPress?: () => void;
  onReactPress?: (emoji: string) => void;
  onSwipeToReply?: (message: ChatMessage) => void;
  onReplyPress?: (replyToId: string) => void;
}

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

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  onOpenViewOnce,
  onOpenImage,
  onLongPress,
  onReactPress,
  onSwipeToReply,
  onReplyPress,
}) => {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const swipeableRef = useRef<Swipeable>(null);

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;

    const replyText = getReplyText(message.replyTo);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onReplyPress && onReplyPress(message.replyTo.id)}
        style={[styles.replyBubble, isMe ? styles.myReplyBubble : styles.peerReplyBubble]}
      >
        <View style={styles.replyBar} />
        <View style={styles.replyContent}>
          <Text style={styles.replySender}>
            {message.replyTo.sender?.displayName || message.replyTo.sender?.username || 'User'}
          </Text>
          <Text style={styles.replyText} numberOfLines={1}>
            {replyText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const grouped: Record<string, number> = {};
    message.reactions.forEach((r) => {
      grouped[r.emoji] = (grouped[r.emoji] || 0) + 1;
    });

    return (
      <View style={[styles.reactionsContainer, isMe ? styles.myReactions : styles.peerReactions]}>
        {Object.entries(grouped).map(([emoji, count]) => (
          <TouchableOpacity
            key={emoji}
            activeOpacity={0.8}
            onPress={() => onReactPress && onReactPress(emoji)}
            style={styles.reactionBadge}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.replyActionContainer}>
        <Animated.View style={[styles.replyActionIcon, { transform: [{ scale }] }]}>
          <Reply size={20} color={COLORS.primary} />
        </Animated.View>
      </View>
    );
  };

  const renderContent = () => {
    if (message.viewOnce && message.isViewed) {
      return (
        <View style={isMe ? styles.myContainer : styles.peerContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            delayLongPress={180}
            onLongPress={onLongPress}
            style={[styles.bubble, isMe ? styles.myBubble : styles.peerBubble]}
          >
            <View style={styles.viewOnceBox}>
              <Eye size={16} color={COLORS.textMuted} />
              <Text style={styles.viewOnceOpenedText}>View once photo opened</Text>
            </View>
            <Text style={styles.timeText}>{time}</Text>
          </TouchableOpacity>
          {renderReactions()}
        </View>
      );
    }

    if (message.viewOnce && !message.isViewed) {
      return (
        <View style={isMe ? styles.myContainer : styles.peerContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            delayLongPress={180}
            onPress={isMe ? undefined : onOpenViewOnce}
            onLongPress={onLongPress}
            style={[styles.bubble, isMe ? styles.myBubble : styles.peerBubble]}
          >
            <View style={styles.viewOnceBox}>
              {isMe ? (
                <Eye size={18} color="rgba(255, 255, 255, 0.6)" />
              ) : (
                <Eye size={18} color={COLORS.primary} />
              )}
              <Text style={[
                styles.viewOncePendingText,
                isMe ? { color: 'rgba(255, 255, 255, 0.8)' } : null
              ]}>
                {isMe ? '1 View Once Photo' : '1 View Once Photo (Tap to view)'}
              </Text>
            </View>
            <Text style={[styles.timeText, isMe ? styles.myTime : styles.peerTime]}>{time}</Text>
          </TouchableOpacity>
          {renderReactions()}
        </View>
      );
    }

    const isVoice = message.messageType === 'VOICE';
    let voicePayload: { audioUrl: string; duration: number; waveform: number[] } | null = null;
    if (isVoice && message.decryptedText) {
      try {
        voicePayload = JSON.parse(message.decryptedText);
      } catch (err) {
        console.warn('Failed to parse voice message JSON payload:', err);
      }
    }

    const isImage =
      !isVoice &&
      (message.messageType === 'IMAGE' ||
        (message.decryptedText &&
          message.decryptedText.startsWith('http') &&
          (message.decryptedText.includes('/uploads/') ||
            message.decryptedText.endsWith('.jpg') ||
            message.decryptedText.endsWith('.png') ||
            message.decryptedText.endsWith('.jpeg'))));

    const imageUri = message.decryptedText || message.encryptedContent;

    return (
      <View style={isMe ? styles.myContainer : styles.peerContainer}>
        <TouchableOpacity
          activeOpacity={0.95}
          delayLongPress={180}
          onLongPress={onLongPress}
          style={[styles.bubble, isMe ? styles.myBubble : styles.peerBubble]}
        >
          {renderReplyPreview()}
          {isVoice && voicePayload ? (
            <VoiceMessageBubble
              audioUrl={voicePayload.audioUrl}
              duration={voicePayload.duration}
              waveform={voicePayload.waveform}
              isSender={isMe}
              timestamp={time}
              isViewed={message.isViewed}
            />
          ) : isImage ? (
            <TouchableOpacity
              activeOpacity={0.9}
              delayLongPress={180}
              onPress={() => onOpenImage && onOpenImage(imageUri)}
              onLongPress={onLongPress}
              style={styles.imageContainer}
            >
              <CachedImage
                uri={message.attachments?.[0]?.thumbnailUrl || imageUri}
                style={styles.attachedImage}
                blurHash={message.attachments?.[0]?.blurHash}
              />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, isMe ? styles.myText : styles.peerText]}>
              {message.decryptedText ?? message.encryptedContent}
            </Text>
          )}

          <View style={styles.footerRow}>
            <Lock size={10} color={isMe ? 'rgba(255, 255, 255, 0.6)' : COLORS.textMuted} style={styles.lockIcon} />
            <Text style={[styles.timeText, isMe ? styles.myTime : styles.peerTime]}>{time}</Text>
            {isMe && (
              <CheckCheck
                size={12}
                color={message.isViewed ? COLORS.primary : COLORS.textMuted}
                style={styles.checkIcon}
              />
            )}
          </View>
        </TouchableOpacity>
        {renderReactions()}
      </View>
    );
  };

  const bubbleContent = renderContent();

  if (!isMe && onSwipeToReply) {
    return (
      <Swipeable
        ref={swipeableRef}
        friction={2}
        leftThreshold={40}
        renderLeftActions={renderLeftActions}
        onSwipeableOpen={(direction) => {
          if (direction === 'left') {
            onSwipeToReply(message);
            try {
              Vibration.vibrate(15);
            } catch (err) {}
            setTimeout(() => {
              swipeableRef.current?.close();
            }, 50);
          }
        }}
      >
        {bubbleContent}
      </Swipeable>
    );
  }

  return bubbleContent;
};

const styles = StyleSheet.create({
  myContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    width: '100%',
    marginVertical: 2,
  },
  peerContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    marginVertical: 2,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2A4B7C',
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
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -6,
    zIndex: 10,
  },
  myReactions: {
    marginRight: 12,
    alignSelf: 'flex-end',
  },
  peerReactions: {
    marginLeft: 12,
    alignSelf: 'flex-start',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  replyBubble: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  myReplyBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  peerReplyBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  replyBar: {
    width: 3.5,
    backgroundColor: COLORS.primary,
  },
  replyContent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
  },
  replySender: {
    fontWeight: '700',
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  replyActionContainer: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyActionIcon: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
