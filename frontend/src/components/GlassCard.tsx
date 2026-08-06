import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { COLORS } from '../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 0,               // Sharp corners
    borderColor: '#FFFFFF',        // Pure white borders
    borderWidth: 2,                // Thick borders
    padding: 20,
    shadowColor: '#FFFFFF',        // White block shadow
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,               // Hard shadow (no blur)
    elevation: 4,
  },
});
