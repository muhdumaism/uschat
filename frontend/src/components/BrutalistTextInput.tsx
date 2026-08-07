import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../theme/brutalistTheme';

interface BrutalistTextInputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const BrutalistTextInput: React.FC<BrutalistTextInputProps> = ({
  icon,
  containerStyle,
  style,
  placeholderTextColor = '#888888',
  ...props
}) => {
  const { colors } = useBrutalistTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.border,
        },
        containerStyle,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <TextInput
        style={[
          styles.input,
          {
            color: colors.textPrimary,
          },
          style,
        ]}
        placeholderTextColor={placeholderTextColor}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BRUTALIST_STYLES.borderWidthThin,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
  },
  iconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
});
