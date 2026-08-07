import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';

export const SplashScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brandingBox, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconContainer}>
          <ShieldCheck size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.logoText}>USCHAT</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>END-TO-END ENCRYPTED</Text>
        </View>
      </Animated.View>
      <Text style={styles.loaderText}>LOADING...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  brandingBox: {
    width: '100%',
    backgroundColor: '#121212',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  loaderText: {
    position: 'absolute',
    bottom: 50,
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
