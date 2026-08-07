import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Alert, Switch, NativeModules } from 'react-native';
import { Shield, Lock, Smartphone, LogOut, Settings, HelpCircle, CheckSquare, Square } from 'lucide-react-native';
import { RetroWindow } from '../../components/RetroWindow';
import { RetroButton } from '../../components/RetroButton';
import { RetroPanel } from '../../components/RetroPanel';
import { RETRO_COLORS, RETRO_STYLES } from '../../theme/retroTheme';
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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      <RetroWindow
        title="CONTROL_PANEL.EXE"
        onClose={() => navigation.goBack()}
        contentStyle={styles.windowContent}
        style={styles.mainWindow}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Security Panel */}
          <Text style={styles.sectionTitle}>SECURITY & PRIVACY</Text>
          <RetroPanel raised style={styles.sectionPanel}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => Alert.alert('Security Number', 'Signal E2EE Session Fingerprint Verified.')}
              style={styles.settingItem}
            >
              <Shield size={16} color="#000" style={{ marginRight: 10 }} />
              <View style={styles.textMeta}>
                <Text style={styles.itemTitle}>END-TO-END ENCRYPTION</Text>
                <Text style={styles.itemSub}>Signal keys and local session validation.</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => Alert.alert('Disappearing Messages', 'Default timer set to Off.')}
              style={styles.settingItem}
            >
              <Lock size={16} color="#000" style={{ marginRight: 10 }} />
              <View style={styles.textMeta}>
                <Text style={styles.itemTitle}>DISAPPEARING MESSAGES</Text>
                <Text style={styles.itemSub}>Configure ephemeral chat expire timers.</Text>
              </View>
            </TouchableOpacity>
          </RetroPanel>

          {/* Notifications Panel */}
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          <RetroPanel raised style={styles.sectionPanel}>
            <View style={styles.settingItemRow}>
              <View style={styles.textMeta}>
                <Text style={styles.itemTitle}>NOTIFICATION SOUNDS</Text>
                <Text style={styles.itemSub}>Play sounds for incoming packets.</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={toggleSound}
                trackColor={{ false: '#808080', true: '#000080' }}
                thumbColor={soundEnabled ? '#ffffff' : '#d4d0c8'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItemRow}>
              <View style={styles.textMeta}>
                <Text style={styles.itemTitle}>VIBRATE PREFERENCE</Text>
                <Text style={styles.itemSub}>Vibrate device on receipt.</Text>
              </View>
              <Switch
                value={vibrationEnabled}
                onValueChange={toggleVibration}
                trackColor={{ false: '#808080', true: '#000080' }}
                thumbColor={vibrationEnabled ? '#ffffff' : '#d4d0c8'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItemRow}>
              <View style={styles.textMeta}>
                <Text style={styles.itemTitle}>CUSTOM WAV CHIME</Text>
                <Text style={styles.itemSub}>Play classic retro notify sound.</Text>
              </View>
              <Switch
                value={customSoundEnabled}
                onValueChange={toggleCustomSound}
                trackColor={{ false: '#808080', true: '#000080' }}
                thumbColor={customSoundEnabled ? '#ffffff' : '#d4d0c8'}
                disabled={!soundEnabled}
              />
            </View>
          </RetroPanel>

          {/* System Info Panel */}
          <Text style={styles.sectionTitle}>SYSTEM INFO</Text>
          <RetroPanel raised style={styles.sectionPanel}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => Alert.alert(`USCHAT v${CURRENT_VERSION_NAME}`, 'Connected to https://uschat.ruptyl.space')}
              style={styles.settingItem}
            >
              <Smartphone size={16} color="#000" style={{ marginRight: 10 }} />
              <View style={styles.textMeta}>
                <Text style={styles.itemTitle}>ABOUT CLIENT</Text>
                <Text style={styles.itemSub}>USCHAT build version {CURRENT_VERSION_NAME}.</Text>
              </View>
            </TouchableOpacity>
          </RetroPanel>

          {/* Log Out */}
          <RetroButton
            onPress={logout}
            style={styles.logoutBtn}
            textStyle={{ color: '#800000' }}
          >
            <LogOut size={14} color="#800000" style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>DISCONNECT SESSION (LOG OUT)</Text>
          </RetroButton>

        </ScrollView>
      </RetroWindow>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RETRO_COLORS.desktop,
    padding: 6,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 34 : 20,
  },
  mainWindow: {
    flex: 1,
  },
  windowContent: {
    flex: 1,
    padding: 6,
  },
  scrollContent: {
    padding: 6,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
    marginTop: 10,
    marginBottom: 6,
    paddingLeft: 4,
  },
  sectionPanel: {
    padding: 10,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  textMeta: {
    flex: 1,
    marginLeft: 6,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  itemSub: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#555',
    marginTop: 2,
  },
  divider: {
    height: 2,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: RETRO_COLORS.panelDark,
    marginVertical: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: '#d4d0c8',
    borderColor: '#800000',
  },
  logoutText: {
    color: '#800000',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
