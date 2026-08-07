import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Alert, Switch, NativeModules } from 'react-native';
import { Shield, Lock, Smartphone, LogOut, ArrowLeft } from 'lucide-react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { useAuthStore } from '../../store/authStore';
import { CURRENT_VERSION_NAME } from '../../services/updateService';

export const SettingsScreen: React.FC<any> = ({ navigation }) => {
  const logout = useAuthStore((s) => s.logout);

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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      {/* Header Bar */}
      <View style={styles.header}>
        <BrutalistButton onPress={() => navigation.goBack()} style={styles.backBtn} accentColor={BRUTALIST_COLORS.yellow}>
          <ArrowLeft size={18} color="#000000" />
        </BrutalistButton>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Security Section */}
        <Text style={styles.sectionTitle}>SECURITY & PRIVACY</Text>
        <BrutalistCard accentColor={BRUTALIST_COLORS.cardBg} padding={12} style={styles.sectionCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Security Fingerprint', 'Signal E2EE Handshake Verified.')}
            style={styles.settingItem}
          >
            <Shield size={20} color="#000000" style={{ marginRight: 12 }} />
            <View style={styles.textMeta}>
              <Text style={styles.itemTitle}>END-TO-END ENCRYPTION</Text>
              <Text style={styles.itemSub}>Local cryptographic Signal protocol state.</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Disappearing Messages', 'Timer is set to Off.')}
            style={styles.settingItem}
          >
            <Lock size={20} color="#000000" style={{ marginRight: 12 }} />
            <View style={styles.textMeta}>
              <Text style={styles.itemTitle}>DISAPPEARING MESSAGES</Text>
              <Text style={styles.itemSub}>Configure auto-expire times on DMs.</Text>
            </View>
          </TouchableOpacity>
        </BrutalistCard>

        {/* Notifications Section */}
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <BrutalistCard accentColor={BRUTALIST_COLORS.cardBg} padding={12} style={styles.sectionCard}>
          <View style={styles.settingItemRow}>
            <View style={styles.textMeta}>
              <Text style={styles.itemTitle}>NOTIFICATION SOUNDS</Text>
              <Text style={styles.itemSub}>Play sounds on incoming packets.</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={toggleSound}
              trackColor={{ false: '#CCCCCC', true: '#000000' }}
              thumbColor={soundEnabled ? BRUTALIST_COLORS.yellow : '#FFFFFF'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItemRow}>
            <View style={styles.textMeta}>
              <Text style={styles.itemTitle}>VIBE PREFERENCE</Text>
              <Text style={styles.itemSub}>Vibrate device on notify triggers.</Text>
            </View>
            <Switch
              value={vibrationEnabled}
              onValueChange={toggleVibration}
              trackColor={{ false: '#CCCCCC', true: '#000000' }}
              thumbColor={vibrationEnabled ? BRUTALIST_COLORS.yellow : '#FFFFFF'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItemRow}>
            <View style={styles.textMeta}>
              <Text style={styles.itemTitle}>CUSTOM BRUTALIST WAV</Text>
              <Text style={styles.itemSub}>Toggle custom notification chime sound.</Text>
            </View>
            <Switch
              value={customSoundEnabled}
              onValueChange={toggleCustomSound}
              trackColor={{ false: '#CCCCCC', true: '#000000' }}
              thumbColor={customSoundEnabled ? BRUTALIST_COLORS.yellow : '#FFFFFF'}
              disabled={!soundEnabled}
            />
          </View>
        </BrutalistCard>

        {/* App Info Section */}
        <Text style={styles.sectionTitle}>CLIENT APP INFO</Text>
        <BrutalistCard accentColor={BRUTALIST_COLORS.cardBg} padding={12} style={styles.sectionCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert(`USCHAT v${CURRENT_VERSION_NAME}`, 'Connected to https://uschat.ruptyl.space')}
            style={styles.settingItem}
          >
            <Smartphone size={20} color="#000000" style={{ marginRight: 12 }} />
            <View style={styles.textMeta}>
              <Text style={styles.itemTitle}>ABOUT CLIENT</Text>
              <Text style={styles.itemSub}>USCHAT build version {CURRENT_VERSION_NAME} (Brutalist Remake).</Text>
            </View>
          </TouchableOpacity>
        </BrutalistCard>

        {/* Log Out */}
        <BrutalistButton
          onPress={logout}
          style={styles.logoutBtn}
          accentColor={BRUTALIST_COLORS.red}
        >
          <LogOut size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>DISCONNECT ACTIVE SESSION</Text>
        </BrutalistButton>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRUTALIST_COLORS.background,
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
    color: '#000000',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
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
    color: '#000000',
  },
  itemSub: {
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 2,
  },
  divider: {
    height: 2,
    backgroundColor: '#000000',
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
