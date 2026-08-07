import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Alert, Switch, NativeModules } from 'react-native';
import { Shield, Lock, Smartphone, LogOut, ArrowLeft } from 'lucide-react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { CURRENT_VERSION_NAME } from '../../services/updateService';

export const SettingsScreen: React.FC<any> = ({ navigation }) => {
  const logout = useAuthStore((s) => s.logout);
  const { colors, isDarkMode } = useBrutalistTheme();
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [customSoundEnabled, setCustomSoundEnabled] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      const loadPrefs = async () => {
        try {
          const sound = await NativeModules.USChatModule.getBoolPreference('sound_enabled', true);
          const vib = await NativeModules.USChatModule.getBoolPreference('vibration_enabled', true);
          const custom = await NativeModules.USChatModule.getBoolPreference('custom_sound_enabled', true);
          setSoundEnabled(sound);
          setVibrationEnabled(vib);
          setCustomSoundEnabled(custom);
        } catch (err) {
          console.warn('Failed to load native preferences:', err);
        }
      };
      loadPrefs();
    }
  }, []);

  const toggleSound = (val: boolean) => {
    setSoundEnabled(val);
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      NativeModules.USChatModule.setBoolPreference('sound_enabled', val);
    }
  };

  const toggleVibration = (val: boolean) => {
    setVibrationEnabled(val);
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      NativeModules.USChatModule.setBoolPreference('vibration_enabled', val);
    }
  };

  const toggleCustomSound = (val: boolean) => {
    setCustomSoundEnabled(val);
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      NativeModules.USChatModule.setBoolPreference('custom_sound_enabled', val);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      {/* Header Bar */}
      <View style={styles.header}>
        <BrutalistButton onPress={() => navigation.goBack()} style={styles.backBtn} accentColor={colors.yellow}>
          <ArrowLeft size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
        </BrutalistButton>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>SETTINGS</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Security Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>SECURITY & PRIVACY</Text>
        <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.sectionCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Security', 'Encryption is active and verified.')}
            style={styles.settingItem}
          >
            <Shield size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
            <View style={styles.textMeta}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>END-TO-END ENCRYPTION</Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>Manage your encryption keys.</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Disappearing Messages', 'Timer is set to Off.')}
            style={styles.settingItem}
          >
            <Lock size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
            <View style={styles.textMeta}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>DISAPPEARING MESSAGES</Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>Configure auto-expire times on DMs.</Text>
            </View>
          </TouchableOpacity>
        </BrutalistCard>

        {/* Theme Preferences */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>THEME PREFERENCE</Text>
        <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.sectionCard}>
          <View style={styles.settingItemRow}>
            <View style={styles.textMeta}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>DARK MODE</Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>Toggle high-contrast black Neo-Brutalist layout.</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#CCCCCC', true: colors.border }}
              thumbColor={isDarkMode ? colors.yellow : '#FFFFFF'}
            />
          </View>
        </BrutalistCard>

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>NOTIFICATIONS</Text>
        <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.sectionCard}>
          <View style={styles.settingItemRow}>
            <View style={styles.textMeta}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>NOTIFICATION SOUNDS</Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>Play sounds on incoming packets.</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={toggleSound}
              trackColor={{ false: '#CCCCCC', true: colors.border }}
              thumbColor={soundEnabled ? colors.yellow : '#FFFFFF'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingItemRow}>
            <View style={styles.textMeta}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>VIBE PREFERENCE</Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>Vibrate device on notify triggers.</Text>
            </View>
            <Switch
              value={vibrationEnabled}
              onValueChange={toggleVibration}
              trackColor={{ false: '#CCCCCC', true: colors.border }}
              thumbColor={vibrationEnabled ? colors.yellow : '#FFFFFF'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingItemRow}>
            <View style={styles.textMeta}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>CUSTOM BRUTALIST WAV</Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>Toggle custom notification chime sound.</Text>
            </View>
            <Switch
              value={customSoundEnabled}
              onValueChange={toggleCustomSound}
              trackColor={{ false: '#CCCCCC', true: colors.border }}
              thumbColor={customSoundEnabled ? colors.yellow : '#FFFFFF'}
              disabled={!soundEnabled}
            />
          </View>
        </BrutalistCard>

        {/* App Info Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>CLIENT APP INFO</Text>
        <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.sectionCard}>
          <View style={styles.settingItem}>
            <Smartphone size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
            <View style={styles.textMeta}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>ABOUT CLIENT</Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>USCHAT build version {CURRENT_VERSION_NAME} (Brutalist Remake).</Text>
            </View>
          </View>
        </BrutalistCard>

        {/* Log Out */}
        <BrutalistButton
          onPress={logout}
          style={styles.logoutBtn}
          accentColor={colors.red}
        >
          <LogOut size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>LOG OUT</Text>
        </BrutalistButton>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 44 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginTop: 22,
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionCard: {
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  textMeta: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  itemSub: {
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    marginTop: 2,
  },
  divider: {
    height: 2,
    marginVertical: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    marginTop: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
});
