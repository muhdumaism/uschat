import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps, ViewStyle, TextStyle } from 'react-native';
import { RETRO_COLORS, RETRO_STYLES } from '../theme/retroTheme';

interface RetroTextInputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const RetroTextInput: React.FC<RetroTextInputProps> = ({
  icon,
  containerStyle,
  inputStyle,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <TextInput
        placeholderTextColor="#808080"
        style={[styles.input, inputStyle]}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RETRO_COLORS.surface,
    ...RETRO_STYLES.borderSunken,
    height: 38,
    paddingHorizontal: 8,
  },
  iconWrapper: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: '#000000',
    fontSize: 13,
    fontFamily: 'monospace',
    height: '100%',
    paddingVertical: 0,
  },
});
