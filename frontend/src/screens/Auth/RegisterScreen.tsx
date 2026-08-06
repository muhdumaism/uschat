import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { Mail, Lock, User, ShieldCheck, Globe, Key } from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { GlassInput } from '../../components/GlassInput';
import { Button } from '../../components/Button';
import { COLORS } from '../../theme/colors';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export const RegisterScreen: React.FC<any> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const validateEmail = (inputEmail: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail);
  };

  const handleRegister = async () => {
    if (!email || !username || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    try {
      setLoading(true);
      const res = await apiClient.post('/auth/register', {
        email: email.trim(),
        username: username.trim().toLowerCase(),
        displayName: displayName.trim() || username.trim(),
        password,
        deviceName: `${Platform.OS.toUpperCase()} Mobile Device`,
      });

      await setAuth(res.data.user, res.data.token, res.data.refreshToken);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Try a different username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.statusBarSpacer} />

        <View style={styles.mainCardWrapper}>
          <GlassCard style={styles.card}>
            {/* Real Transparent App Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/uschatlogo-trans.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>Create your Account</Text>
            <Text style={styles.subtitle}>
              Join USCHAT for fast, secure messaging & calls.
            </Text>

            {/* Input Fields */}
            <View style={styles.inputContainer}>
              <View style={styles.inputGap}>
                <GlassInput
                  placeholder="Email"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    setError('');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  icon={<Mail size={18} color={COLORS.textMuted} />}
                />
              </View>

              <View style={styles.inputGap}>
                <GlassInput
                  placeholder="Username (@username)"
                  value={username}
                  onChangeText={(val) => {
                    setUsername(val);
                    setError('');
                  }}
                  autoCapitalize="none"
                  icon={<User size={18} color={COLORS.textMuted} />}
                />
              </View>

              <View style={styles.inputGap}>
                <GlassInput
                  placeholder="Display Name (Optional)"
                  value={displayName}
                  onChangeText={setDisplayName}
                  icon={<User size={18} color={COLORS.textMuted} />}
                />
              </View>

              <View style={styles.inputGap}>
                <GlassInput
                  placeholder="Password"
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setError('');
                  }}
                  secureTextEntry
                  icon={<Lock size={18} color={COLORS.textMuted} />}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            {/* Submit Button */}
            <Button
              title="Get Started"
              onPress={handleRegister}
              loading={loading}
              style={styles.submitBtn}
            />

            {/* Dashed Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Protected by USCHAT Security</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Security Highlights */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                onPress={() => Alert.alert('Security Check', 'Session Security Active')}
                style={styles.socialBtn}
              >
                <ShieldCheck size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('Connection Status', 'All servers secure and verified')}
                style={styles.socialBtn}
              >
                <Globe size={22} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('Privacy Protection', 'Your keys and session stay on your device.')}
                style={styles.socialBtn}
              >
                <Key size={22} color={COLORS.success} />
              </TouchableOpacity>
            </View>

            {/* Already Have Account Footer Link */}
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.highlightText}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 48 : 24,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  mainCardWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: COLORS.cardBorder,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 8,
  },
  inputGap: {
    marginBottom: 14,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'left',
  },
  submitBtn: {
    width: '100%',
    marginTop: 4,
    marginBottom: 20,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 24,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.secondaryBackground,
    borderColor: COLORS.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  footerLink: {
    marginTop: 4,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  highlightText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

