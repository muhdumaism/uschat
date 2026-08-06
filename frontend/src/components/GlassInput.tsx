import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { COLORS } from '../theme/colors';

interface GlassInputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const GlassInput: React.FC<GlassInputProps> = ({ icon, containerStyle, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, isFocused && styles.focusedContainer, containerStyle]}>
      {icon && <View style={styles.iconBox}>{icon}</View>}
      <TextInput
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',     // Pure Black
    borderRadius: 0,                // Sharp corners
    borderWidth: 2,                 // Thick borders
    borderColor: '#FFFFFF',         // White border
    paddingHorizontal: 16,
    height: 52,
  },
  focusedContainer: {
    borderColor: COLORS.primary,    // Electric Blue active focus border
    shadowColor: COLORS.primary,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  iconBox: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
