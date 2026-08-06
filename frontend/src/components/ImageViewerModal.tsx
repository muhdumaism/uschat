import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, Platform, NativeModules } from 'react-native';
import { X, Eye, Lock } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

interface ImageViewerModalProps {
  visible: boolean;
  imageUri: string | null;
  isViewOnce?: boolean;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUri,
  isViewOnce = false,
  onClose,
}) => {
  useEffect(() => {
    if (visible && isViewOnce && Platform.OS === 'android' && NativeModules.USChatModule) {
      try {
        NativeModules.USChatModule.setSecureWindow(true);
      } catch (err) {
        console.warn('Failed to enable secure window:', err);
      }
    }
    return () => {
      if (Platform.OS === 'android' && NativeModules.USChatModule) {
        try {
          NativeModules.USChatModule.setSecureWindow(false);
        } catch (err) {
          console.warn('Failed to disable secure window:', err);
        }
      }
    };
  }, [visible, isViewOnce]);

  if (!visible || !imageUri) return null;

  return (
    <View style={[styles.container, StyleSheet.absoluteFill, { zIndex: 9999 }]}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.badge}>
            {isViewOnce ? (
              <>
                <Eye size={16} color={COLORS.primary} />
                <Text style={styles.badgeText}>View Once Photo</Text>
              </>
            ) : (
              <>
                <Lock size={14} color={COLORS.accent} />
                <Text style={styles.badgeText}>Encrypted Photo</Text>
              </>
            )}
          </View>

          <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.closeBtn}>
            <X size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Center Image */}
        <View style={styles.imageWrapper}>
          <Image source={{ uri: imageUri }} style={styles.fullImage} resizeMode="contain" />
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.footerNotice}>
            {isViewOnce
              ? 'This photo will disappear after closing.'
              : 'Protected by End-to-End Encryption.'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerNotice: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
});
