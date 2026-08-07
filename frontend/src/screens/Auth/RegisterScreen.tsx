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
import { Mail, Lock, User, ShieldAlert } from 'lucide-react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { BrutalistTextInput } from '../../components/BrutalistTextInput';
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
      setError('PLEASE FILL IN ALL REQUIRED FIELDS.');
      return;
    }

    if (!validateEmail(email)) {
      setError('PLEASE ENTER A VALID EMAIL ADDRESS.');
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
        deviceName: `${Platform.OS.toUpperCase()} MOBILE DEVICE`,
      });

      await setAuth(res.data.user, res.data.token, res.data.refreshToken);
    } catch (err: any) {
      setError(err.response?.data?.message?.toUpperCase() || 'REGISTRATION FAILED. TRY ANOTHER USERNAME.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.statusBarSpacer} />

        <View style={styles.cardWrapper}>
          <BrutalistCard
            accentColor={BRUTALIST_COLORS.cardBg}
            padding={24}
            style={styles.card}
          >
            {/* Header branding */}
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                <Image
                  source={require('../../../assets/uschatlogo-trans.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.brandInfo}>
                <Text style={styles.brandTitle}>USCHAT SECURE</Text>
                <Text style={styles.brandSub}>ESTABLISH CLIENT NODE</Text>
              </View>
            </View>

            {/* Info box banner */}
            <BrutalistCard
              accentColor={BRUTALIST_COLORS.blue}
              padding={10}
              style={styles.banner}
              borderRadius={BRUTALIST_STYLES.borderRadiusSmall}
            >
              <Text style={styles.bannerText}>
                ENTER A VALID EMAIL AND UNIQUE ID TO SPIN UP AN E2EE MESSAGING IDENTITY.
              </Text>
            </BrutalistCard>

            {/* Input form */}
            <View style={styles.form}>
              <Text style={styles.label}>EMAIL ADDRESS *</Text>
              <BrutalistTextInput
                placeholder="client@uschat.space"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setError('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                icon={<Mail size={16} color="#000000" />}
                containerStyle={{ marginBottom: 16 }}
              />

              <Text style={styles.label}>USERNAME HANDLE *</Text>
              <BrutalistTextInput
                placeholder="client_node"
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  setError('');
                }}
                autoCapitalize="none"
                icon={<User size={16} color="#000000" />}
                containerStyle={{ marginBottom: 16 }}
              />

              <Text style={styles.label}>DISPLAY NAME (OPTIONAL)</Text>
              <BrutalistTextInput
                placeholder="CLIENT CORE"
                value={displayName}
                onChangeText={setDisplayName}
                icon={<User size={16} color="#000000" />}
                containerStyle={{ marginBottom: 16 }}
              />

              <Text style={styles.label}>SECURITY PASSWORD *</Text>
              <BrutalistTextInput
                placeholder="••••••••••••"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  setError('');
                }}
                secureTextEntry
                icon={<Lock size={16} color="#000000" />}
                containerStyle={{ marginBottom: 20 }}
              />

              {error ? (
                <View style={styles.errorContainer}>
                  <ShieldAlert size={16} color={BRUTALIST_COLORS.red} style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <BrutalistButton
                title={loading ? "CREATING..." : "OK"}
                onPress={handleRegister}
                disabled={loading}
                style={styles.btn}
                accentColor={BRUTALIST_COLORS.yellow}
              />
              <BrutalistButton
                title="CLEAR"
                onPress={() => {
                  setEmail('');
                  setUsername('');
                  setDisplayName('');
                  setPassword('');
                  setError('');
                }}
                style={styles.btn}
                accentColor={BRUTALIST_COLORS.blue}
                textStyle={{ color: '#FFFFFF' }}
              />
            </View>

            {/* Switch to login */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.footerLink}
              >
                <Text style={styles.footerText}>
                  ALREADY AN IDENTITY NODE? <Text style={styles.highlight}>SIGN IN</Text>
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
    color: '#FFFFFF',
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
    width: 100,
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
