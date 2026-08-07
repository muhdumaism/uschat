import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { RETRO_COLORS, RETRO_STYLES } from '../theme/retroTheme';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  showControls?: boolean;
}

export const RetroWindow: React.FC<RetroWindowProps> = ({
  title,
  children,
  onClose,
  onMinimize,
  style,
  contentStyle,
  showControls = true,
}) => {
  return (
    <View style={[styles.windowContainer, style]}>
      {/* Title Bar */}
      <View style={styles.titleBar}>
        <Text style={styles.titleText} numberOfLines={1}>
          {title}
        </Text>
        
        {showControls && (
          <View style={styles.controlButtons}>
            {onMinimize && (
              <TouchableOpacity activeOpacity={0.8} onPress={onMinimize} style={styles.controlBtn}>
                <Text style={styles.controlBtnText}>_</Text>
              </TouchableOpacity>
            )}
            
            {onClose && (
              <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={[styles.controlBtn, { marginLeft: 2 }]}>
                <Text style={[styles.controlBtnText, { fontWeight: 'bold' }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Client Area */}
      <View style={[styles.clientArea, contentStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  windowContainer: {
    backgroundColor: RETRO_COLORS.windowBackground,
    ...RETRO_STYLES.borderRaised,
    padding: 3,
  },
  titleBar: {
    height: 22,
    backgroundColor: RETRO_COLORS.titleBarBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  titleText: {
    color: RETRO_COLORS.titleBarText,
    fontWeight: 'bold',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlBtn: {
    width: 16,
    height: 14,
    backgroundColor: RETRO_COLORS.windowBackground,
    ...RETRO_STYLES.borderRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnText: {
    color: '#000000',
    fontSize: 9,
    fontFamily: 'monospace',
    lineHeight: 10,
  },
  clientArea: {
    flex: 1,
  },
});
