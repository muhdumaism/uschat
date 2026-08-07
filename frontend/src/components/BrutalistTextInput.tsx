import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES } from '../theme/brutalistTheme';

interface BrutalistTextInputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const BrutalistTextInput: React.FC<BrutalistTextInputProps> = ({
  icon,
  containerStyle,
  style,
  placeholderTextColor = '#777777',
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <TextInput
        style={[styles.input, style]}
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
    backgroundColor: '#FFFFFF',
    borderWidth: BRUTALIST_STYLES.borderWidthThin,
    borderColor: BRUTALIST_COLORS.border,
    borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
    paddingHorizontal: 12,
    height: 48,
  },
  iconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    color: BRUTALIST_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
});
