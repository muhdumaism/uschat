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
import { Mail, Lock, ShieldAlert } from 'lucide-react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { BrutalistTextInput } from '../../components/BrutalistTextInput';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export const LoginScreen: React.FC<any> = ({ navigation }) => {
  const { colors, isDarkMode } = useBrutalistTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const validateEmail = (inputEmail: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('ENTER BOTH EMAIL AND PASSWORD.');
      return;
    }

    if (!validateEmail(email)) {
      setError('ENTER A VALID EMAIL ADDRESS.');
      return;
    }

    setError('');
    try {
      setLoading(true);
      const res = await apiClient.post('/auth/login', {
        email: email.trim(),
        password,
        deviceName: `${Platform.OS.toUpperCase()} MOBILE DEVICE`,
      });

      await setAuth(res.data.user, res.data.token, res.data.refreshToken);
    } catch (err: any) {
      setError(err.response?.data?.message?.toUpperCase() || 'INVALID EMAIL OR PASSWORD.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.statusBarSpacer} />

        <View style={styles.cardWrapper}>
          <BrutalistCard
            accentColor={colors.cardBg}
            padding={24}
            style={styles.card}
          >
            {/* Header info */}
            <View style={styles.logoRow}>
              <View style={[styles.logoBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Image
                  source={require('../../../assets/uschatlogo-trans.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.brandInfo}>
                <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>USCHAT SECURE</Text>
                <Text style={[styles.brandSub, { color: colors.textSecondary }]}>VERSION 2.0.0 (BRUTALIST)</Text>
              </View>
            </View>

            {/* Info panel banner */}
            <BrutalistCard
              accentColor={colors.yellow}
              padding={10}
              style={styles.banner}
              borderRadius={BRUTALIST_STYLES.borderRadiusSmall}
            >
              <Text style={[styles.bannerText, { color: '#000000' }]}>
                Sign in with your email and password to continue.
              </Text>
            </BrutalistCard>

            {/* Form */}
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>EMAIL ADDRESS</Text>
              <BrutalistTextInput
                placeholder="client@uschat.space"
                placeholderTextColor={isDarkMode ? '#666666' : '#888888'}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setError('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                icon={<Mail size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} />}
                containerStyle={{ marginBottom: 20 }}
              />

              <Text style={[styles.label, { color: colors.textPrimary }]}>PASSWORD</Text>
              <BrutalistTextInput
                placeholder="••••••••••••"
                placeholderTextColor={isDarkMode ? '#666666' : '#888888'}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  setError('');
                }}
                secureTextEntry
                icon={<Lock size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} />}
                containerStyle={{ marginBottom: 24 }}
              />

              {error ? (
                <View style={[styles.errorContainer, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#FFEEEE', borderColor: colors.red }]}>
                  <ShieldAlert size={16} color={colors.red} style={{ marginRight: 8 }} />
                  <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
                </View>
              ) : null}
            </View>

            {/* Action controls */}
            <View style={styles.actionRow}>
              <BrutalistButton
                title={loading ? "DIALING..." : "OK"}
                onPress={handleLogin}
                disabled={loading}
                style={styles.btn}
                accentColor={colors.yellow}
              />
              <BrutalistButton
                title="CLEAR"
                onPress={() => {
                  setEmail('');
                  setPassword('');
                  setError('');
                }}
                style={styles.btn}
                accentColor={colors.blue}
                textStyle={{ color: '#FFFFFF' }}
              />
            </View>

            {/* Navigation Footer */}
            <View style={[styles.footer, { borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                style={styles.footerLink}
              >
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                  New here? <Text style={[styles.highlight, { color: colors.blue }]}>CREATE AN ACCOUNT</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </BrutalistCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRUTALIST_COLORS.background,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 44 : 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 20,
  },
  logoBox: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: BRUTALIST_STYLES.borderWidthThin,
    borderColor: BRUTALIST_COLORS.border,
    borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandInfo: {
    marginLeft: 12,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  brandSub: {
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 2,
  },
  banner: {
    marginBottom: 24,
  },
  bannerText: {
    fontSize: 11,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    marginBottom: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEEEE',
    borderColor: BRUTALIST_COLORS.red,
    borderWidth: BRUTALIST_STYLES.borderWidthThin,
    borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: BRUTALIST_COLORS.red,
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 24,
  },
  btn: {
    width: 90,
  },
  footer: {
    borderTopWidth: BRUTALIST_STYLES.borderWidthThin,
    borderColor: BRUTALIST_COLORS.border,
    paddingTop: 20,
    alignItems: 'center',
  },
  footerLink: {
    paddingVertical: 4,
  },
  footerText: {
    fontSize: 11,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#333333',
  },
  highlight: {
    color: BRUTALIST_COLORS.blue,
    fontWeight: '900',
  },
});
