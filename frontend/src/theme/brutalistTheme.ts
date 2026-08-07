import { StyleSheet } from 'react-native';

export const BRUTALIST_COLORS = {
  background: '#FFFFFF',
  cardBg: '#FFFFFF',
  border: '#000000',
  shadow: '#000000',
  
  // Accents
  yellow: '#FFE600',
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  orange: '#F97316',
  
  // Text
  textPrimary: '#000000',
  textSecondary: '#333333',
  textMuted: '#666666',
  textLight: '#FFFFFF',
};

export const BRUTALIST_STYLES = {
  borderWidth: 3,
  borderWidthThin: 2,
  borderRadius: 16,
  borderRadiusLarge: 20,
  borderRadiusSmall: 8,
  
  // Static shadow parameters (if using standard RN shadows)
  shadowOffset: 8,
  
  fontBold: 'monospace', // Fits the retro-brutalist outline aesthetic perfectly
};

export const brutalistStyles = StyleSheet.create({
  thickBorder: {
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderColor: BRUTALIST_COLORS.border,
  },
  thinBorder: {
    borderWidth: BRUTALIST_STYLES.borderWidthThin,
    borderColor: BRUTALIST_COLORS.border,
  },
  shadowOffsetLayer: {
    position: 'absolute',
    top: BRUTALIST_STYLES.shadowOffset,
    left: BRUTALIST_STYLES.shadowOffset,
    right: -BRUTALIST_STYLES.shadowOffset,
    bottom: -BRUTALIST_STYLES.shadowOffset,
    backgroundColor: BRUTALIST_COLORS.shadow,
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderColor: BRUTALIST_COLORS.border,
  },
});
