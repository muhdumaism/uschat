import React from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../theme/brutalistTheme';

interface BrutalistButtonProps {
  onPress: () => void;
  children?: React.ReactNode;
  title?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accentColor?: string;
  shadowColor?: string;
  disabled?: boolean;
}

export const BrutalistButton: React.FC<BrutalistButtonProps> = ({
  onPress,
  children,
  title,
  style,
  textStyle,
  accentColor,
  shadowColor,
  disabled = false,
}) => {
  const { colors } = useBrutalistTheme();
  const btnBg = accentColor || colors.yellow;
  const btnShadow = shadowColor || colors.shadow;
  const btnBorder = colors.border;

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
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outerContainer,
        outerStyle,
        disabled && { opacity: 0.6 }
      ]}
    >
      {({ pressed }) => {
        // When pressed, translate down and right to overlap the shadow
        const translateOffset = pressed ? 6 : 0;
        
        return (
          <>
            {/* Hard Black/White Shadow Layer */}
            <View
              style={[
                styles.shadowLayer,
                {
                  backgroundColor: btnShadow,
                  borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
                  borderWidth: BRUTALIST_STYLES.borderWidth,
                  borderColor: btnBorder,
                },
              ]}
            />

            {/* Content Button Face */}
            <View
              style={[
                styles.contentLayer,
                innerStyle,
                {
                  backgroundColor: btnBg,
                  borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
                  borderWidth: BRUTALIST_STYLES.borderWidth,
                  borderColor: btnBorder,
                  transform: [
                    { translateX: translateOffset },
                    { translateY: translateOffset },
                  ],
                },
              ]}
            >
              {title ? (
                <Text style={[styles.btnText, { color: colors.textPrimary }, textStyle]}>
                  {title.toUpperCase()}
                </Text>
              ) : (
                children
              )}
            </View>
          </>
        );
      }}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    overflow: 'visible',
    marginRight: 6,
    marginBottom: 6,
  },
  shadowLayer: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
  },
  contentLayer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
    letterSpacing: 1,
  },
});
