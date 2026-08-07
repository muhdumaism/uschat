import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { RETRO_COLORS, RETRO_STYLES } from '../theme/retroTheme';

interface RetroPanelProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}

export const RetroPanel: React.FC<RetroPanelProps> = ({
  children,
  style,
  raised = true,
}) => {
  return (
    <View
      style={[
        styles.panel,
        raised ? styles.raised : styles.sunken,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    padding: 12,
  },
  raised: {
    backgroundColor: RETRO_COLORS.windowBackground,
    ...RETRO_STYLES.borderRaised,
  },
  sunken: {
    backgroundColor: RETRO_COLORS.surface,
    ...RETRO_STYLES.borderSunken,
  },
});
