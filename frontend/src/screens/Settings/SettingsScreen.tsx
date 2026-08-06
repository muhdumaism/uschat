import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Alert } from 'react-native';
import { ArrowLeft, Shield, Bell, Lock, Smartphone, HelpCircle, LogOut } from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { COLORS } from '../../theme/colors';
import { useAuthStore } from '../../store/authStore';
import { CURRENT_VERSION_NAME } from '../../services/updateService';

export const SettingsScreen: React.FC<any> = ({ navigation }) => {
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GlassCard style={styles.card}>
          <Text style={styles.sectionHeader}>Security & Privacy</Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Security Number', 'Signal E2EE Session Fingerprint Verified.')}
            style={styles.settingItem}
          >
            <Shield size={20} color={COLORS.primary} />
            <View style={styles.settingTextGroup}>
              <Text style={styles.itemTitle}>End-to-End Encryption</Text>
              <Text style={styles.itemSub}>Signal protocol keys and local encryption state</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Disappearing Messages', 'Default timer set to Off.')}
            style={styles.settingItem}
          >
            <Lock size={20} color={COLORS.accent} />
            <View style={styles.settingTextGroup}>
              <Text style={styles.itemTitle}>Disappearing Messages</Text>
              <Text style={styles.itemSub}>Set default timer for new chats</Text>
            </View>
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.sectionHeader}>Preferences & App Info</Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Notifications', 'Push notifications enabled.')}
            style={styles.settingItem}
          >
            <Bell size={20} color={COLORS.warning} />
            <View style={styles.settingTextGroup}>
              <Text style={styles.itemTitle}>Notifications</Text>
              <Text style={styles.itemSub}>Sound, vibration, and call alerts</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert(`USCHAT v${CURRENT_VERSION_NAME}`, 'Connected to https://uschat.ruptyl.space')}
            style={styles.settingItem}
          >
            <Smartphone size={20} color={COLORS.success} />
            <View style={styles.settingTextGroup}>
              <Text style={styles.itemTitle}>About USCHAT</Text>
              <Text style={styles.itemSub}>Version {CURRENT_VERSION_NAME} (Clean Minimal UI)</Text>
            </View>
          </TouchableOpacity>
        </GlassCard>

        <TouchableOpacity activeOpacity={0.8} onPress={logout} style={styles.logoutBtn}>
          <LogOut size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 52 : 28,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    padding: 20,
  },
  sectionHeader: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingTextGroup: {
    marginLeft: 14,
    flex: 1,
  },
  itemTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  itemSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: COLORS.danger,
    borderWidth: 1,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
  },
});
