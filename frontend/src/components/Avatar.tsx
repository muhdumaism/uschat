import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  isOnline?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 48, isOnline }) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const borderSize = size >= 60 ? 3 : 2;

  return (
    <View style={[{ width: size, height: size, borderWidth: borderSize, borderColor: '#FFFFFF', borderRadius: 0 }, styles.container]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <View style={styles.fallback}>
          <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
        </View>
      )}
      {isOnline && (
        <View
          style={[
            styles.onlineBadge,
            {
              width: Math.max(10, size * 0.22),
              height: Math.max(10, size * 0.22),
              bottom: -1,
              right: -1,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  fallback: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  onlineBadge: {
    position: 'absolute',
    backgroundColor: '#00FF66',     // Electric success green
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 0,                // Sharp square badge
  },
});
