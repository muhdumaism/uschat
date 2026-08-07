import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, View, StyleProp } from 'react-native';
import { RETRO_COLORS, RETRO_STYLES } from '../theme/retroTheme';

interface RetroButtonProps {
  onPress: () => void;
  children?: React.ReactNode;
  title?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const RetroButton: React.FC<RetroButtonProps> = ({
  onPress,
  children,
  title,
  style,
  textStyle,
  disabled = false,
}) => {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? styles.pressed : styles.unpressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {({ pressed }) => {
        const offsetStyle = pressed && !disabled ? styles.pressedOffset : null;
        return (
          <View style={[styles.contentContainer, offsetStyle]}>
            {title ? (
              <Text
                style={[
                  styles.buttonText,
                  disabled && styles.disabledText,
                  textStyle,
                ]}
              >
                {title}
              </Text>
            ) : (
              children
            )}
          </View>
        );
      }}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: RETRO_COLORS.windowBackground,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unpressed: {
    ...RETRO_STYLES.borderRaised,
  },
  pressed: {
    ...RETRO_STYLES.borderSunken,
  },
  disabled: {
    ...RETRO_STYLES.borderRaised,
    opacity: 0.7,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedOffset: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  buttonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  disabledText: {
    color: RETRO_COLORS.textMuted,
  },
});
