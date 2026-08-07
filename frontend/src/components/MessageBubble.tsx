import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Vibration } from 'react-native';
import { Eye, Lock, CheckCheck, Reply } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../theme/brutalistTheme';
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
    return <View style={[style, { backgroundColor: '#EEEEEE', borderWidth: 2, borderColor: '#000000' }]} />;
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
  const { colors, isDarkMode } = useBrutalistTheme();
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const swipeableRef = useRef<Swipeable>(null);

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;

    const replyText = getReplyText(message.replyTo);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onReplyPress && onReplyPress(message.replyTo.id)}
        style={[
          styles.replyBubble,
          {
            backgroundColor: isMe ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
            borderLeftWidth: 4,
            borderLeftColor: colors.border,
          }
        ]}
      >
        <View style={styles.replyContent}>
          <Text style={[styles.replySender, { color: colors.textPrimary }]}>
            {(message.replyTo.sender?.displayName || message.replyTo.sender?.username || 'User').toUpperCase()}
          </Text>
          <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
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
            style={[styles.reactionBadge, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {count > 1 && <Text style={[styles.reactionCount, { color: colors.textPrimary }]}>{count}</Text>}
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
        <Animated.View style={[styles.replyActionIcon, { backgroundColor: colors.yellow, borderColor: colors.border, transform: [{ scale }] }]}>
          <Reply size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
        </Animated.View>
      </View>
    );
  };

  const renderContent = () => {
    const bubbleBg = isMe ? colors.yellow : colors.cardBg;

    if (message.viewOnce && message.isViewed) {
      return (
        <View style={isMe ? styles.myContainer : styles.peerContainer}>
          <View style={styles.bubbleWrapper}>
            <View style={[styles.shadowLayer, { backgroundColor: colors.border, borderColor: colors.border }]} />
            <TouchableOpacity
              activeOpacity={0.9}
              delayLongPress={180}
              onLongPress={onLongPress}
              style={[styles.bubble, { backgroundColor: bubbleBg, borderColor: colors.border }]}
            >
              <View style={styles.viewOnceBox}>
                <Eye size={16} color={colors.textPrimary} />
                <Text style={[styles.viewOnceOpenedText, { color: colors.textSecondary }]}>VIEW ONCE PHOTO OPENED</Text>
              </View>
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>{time}</Text>
            </TouchableOpacity>
          </View>
          {renderReactions()}
        </View>
      );
    }

    if (message.viewOnce && !message.isViewed) {
      return (
        <View style={isMe ? styles.myContainer : styles.peerContainer}>
          <View style={styles.bubbleWrapper}>
            <View style={[styles.shadowLayer, { backgroundColor: colors.border, borderColor: colors.border }]} />
            <TouchableOpacity
              activeOpacity={0.8}
              delayLongPress={180}
              onPress={isMe ? undefined : onOpenViewOnce}
              onLongPress={onLongPress}
              style={[styles.bubble, { backgroundColor: bubbleBg, borderColor: colors.border }]}
            >
              <View style={styles.viewOnceBox}>
                <Eye size={18} color={colors.textPrimary} />
                <Text style={[styles.viewOncePendingText, { color: colors.textPrimary }]}>
                  {isMe ? 'VIEW ONCE PHOTO' : 'VIEW ONCE PHOTO (TAP TO VIEW)'}
                </Text>
              </View>
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>{time}</Text>
            </TouchableOpacity>
          </View>
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
        <View style={styles.bubbleWrapper}>
          <View style={[styles.shadowLayer, { backgroundColor: colors.border, borderColor: colors.border }]} />
          <TouchableOpacity
            activeOpacity={0.95}
            delayLongPress={180}
            onLongPress={onLongPress}
            style={[styles.bubble, { backgroundColor: bubbleBg, borderColor: colors.border }]}
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
                style={[styles.imageContainer, { borderColor: colors.border }]}
              >
                <CachedImage
                  uri={message.attachments?.[0]?.thumbnailUrl || imageUri}
                  style={styles.attachedImage}
                  blurHash={message.attachments?.[0]?.blurHash}
                />
              </TouchableOpacity>
            ) : (
              <Text style={[styles.messageText, { color: isMe ? '#000000' : colors.textPrimary }]}>
                {message.decryptedText ?? message.encryptedContent}
              </Text>
            )}

            <View style={styles.footerRow}>
              <Lock size={10} color={isMe ? '#333333' : colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.timeText, { color: isMe ? '#333333' : colors.textSecondary }]}>{time}</Text>
              {isMe && (
                <CheckCheck
                  size={12}
                  color={message.isViewed ? colors.pink : (isDarkMode ? '#888888' : '#555555')}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
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
    marginVertical: 8,
    paddingRight: 10,
  },
  peerContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    marginVertical: 8,
    paddingLeft: 6,
  },
  bubbleWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  shadowLayer: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: '#000000',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
  },
  bubble: {
    maxWidth: 280,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000000',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    fontWeight: 'bold',
  },
  imageContainer: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    marginBottom: 4,
  },
  attachedImage: {
    width: 200,
    height: 160,
  },
  viewOnceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  viewOncePendingText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 11,
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginLeft: 6,
  },
  viewOnceOpenedText: {
    color: '#555555',
    fontSize: 11,
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginLeft: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  timeText: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#333333',
    fontWeight: 'bold',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    zIndex: 10,
  },
  myReactions: {
    marginRight: 10,
    alignSelf: 'flex-end',
  },
  peerReactions: {
    marginLeft: 10,
    alignSelf: 'flex-start',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderWidth: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  reactionEmoji: {
    fontSize: 11,
  },
  reactionCount: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginLeft: 2,
  },
  replyBubble: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontWeight: '900',
    fontSize: 10,
    color: '#000000',
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginBottom: 1,
  },
  replyText: {
    fontSize: 11,
    color: '#333333',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  replyActionContainer: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyActionIcon: {
    backgroundColor: BRUTALIST_COLORS.yellow,
    borderWidth: 2,
    borderColor: '#000000',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
