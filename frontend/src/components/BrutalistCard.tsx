import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES } from '../theme/brutalistTheme';

interface BrutalistCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accentColor?: string;
  shadowColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  padding?: number;
}

export const BrutalistCard: React.FC<BrutalistCardProps> = ({
  children,
  style,
  contentStyle,
  accentColor = BRUTALIST_COLORS.cardBg,
  shadowColor = BRUTALIST_COLORS.shadow,
  borderRadius = BRUTALIST_STYLES.borderRadius,
  borderWidth = BRUTALIST_STYLES.borderWidth,
  padding = 16,
}) => {
  // Extract layout/sizing styles to apply to both layers so they align and size identically
  const flat = StyleSheet.flatten(style) || {};
  const outerKeys = [
    'position', 'top', 'bottom', 'left', 'right',
    'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginVertical', 'marginHorizontal',
    'flex', 'flexGrow', 'flexShrink', 'flexBasis',
    'alignSelf',
    'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
    'zIndex',
  ];

  const outerStyle: any = {};
  const innerStyle: any = {};

  Object.keys(flat).forEach((key) => {
    const val = (flat as any)[key];
    if (outerKeys.includes(key)) {
      outerStyle[key] = val;
      if (['flex', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'].includes(key)) {
        innerStyle[key] = val;
      }
    } else {
      innerStyle[key] = val;
    }
  });

  if (outerStyle.flex || outerStyle.height) {
    innerStyle.flex = 1;
  }

  return (
    <View style={[styles.outerContainer, outerStyle]}>
      {/* Black Hard Shadow Layer */}
      <View
        style={[
          styles.shadowLayer,
          {
            backgroundColor: shadowColor,
            borderRadius: borderRadius,
            borderWidth: borderWidth,
            borderColor: BRUTALIST_COLORS.border,
          },
        ]}
      />

      {/* Main Content Layer */}
      <View
        style={[
          styles.contentLayer,
          innerStyle,
          {
            backgroundColor: accentColor,
            borderRadius: borderRadius,
            borderWidth: borderWidth,
            borderColor: BRUTALIST_COLORS.border,
            padding: padding,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    overflow: 'visible',
    marginRight: BRUTALIST_STYLES.shadowOffset,
    marginBottom: BRUTALIST_STYLES.shadowOffset,
  },
  shadowLayer: {
    position: 'absolute',
    top: BRUTALIST_STYLES.shadowOffset,
    left: BRUTALIST_STYLES.shadowOffset,
    right: -BRUTALIST_STYLES.shadowOffset,
    bottom: -BRUTALIST_STYLES.shadowOffset,
  },
  contentLayer: {
    width: '100%',
  },
});
