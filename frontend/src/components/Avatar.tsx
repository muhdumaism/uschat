import React, { useState, useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { MediaCacheService } from '../services/mediaCacheService';

const avatarCache = new Map<string, string>();

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  isOnline?: boolean;
}

export const Avatar = React.memo<AvatarProps>(
  ({ uri, name, size = 48, isOnline }) => {
    const [sourceUri, setSourceUri] = useState<string | null>(uri ? avatarCache.get(uri) || null : null);

    useEffect(() => {
      if (!uri) {
        setSourceUri(null);
        return;
      }
      if (avatarCache.has(uri)) {
        setSourceUri(avatarCache.get(uri) || null);
        return;
      }
      let isMounted = true;
      const resolveAvatar = async () => {
        const cached = await MediaCacheService.getCachedUri(uri);
        avatarCache.set(uri, cached);
        if (isMounted) {
          setSourceUri(cached);
        }
      };
      resolveAvatar();
      return () => { isMounted = false; };
    }, [uri]);

    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const borderSize = size >= 60 ? 3 : 2;
    const radius = size / 2;

    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderWidth: borderSize,
            borderColor: '#FFFFFF',
            borderRadius: radius,
          },
        ]}
      >
        {sourceUri ? (
          <Image source={{ uri: sourceUri }} style={[styles.image, { borderRadius: radius }]} resizeMode="cover" />
        ) : (
          <View style={[styles.fallback, { borderRadius: radius }]}>
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
                borderRadius: Math.max(10, size * 0.22) / 2,
                bottom: -1,
                right: -1,
              },
            ]}
          />
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
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
  },
});
