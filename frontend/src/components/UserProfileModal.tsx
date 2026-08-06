import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { X, User, FileText, Info } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { COLORS } from '../theme/colors';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userData: {
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
  } | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  onClose,
  userData,
}) => {
  if (!visible || !userData) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <GlassCard style={styles.card}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.avatarContainer}>
            <Avatar name={userData.displayName} uri={userData.avatarUrl} size={90} />
          </View>

          <Text style={styles.displayName}>{userData.displayName.toUpperCase()}</Text>
          <Text style={styles.username}>@{userData.username.toLowerCase()}</Text>

          <View style={styles.divider} />

          <View style={styles.bioSection}>
            <Text style={styles.sectionLabel}>BIO / STATUS</Text>
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>
                {userData.bio ? userData.bio : 'NO BIO RECORDED ON SYSTEM.'}
              </Text>
            </View>
          </View>

          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>SECURED ROUTING CHANNEL ACTIVE</Text>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 32,
    backgroundColor: '#121212',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 0,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  username: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  divider: {
    height: 2,
    backgroundColor: '#FFFFFF',
    width: '90%',
    marginVertical: 20,
  },
  bioSection: {
    width: '90%',
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  bioContainer: {
    backgroundColor: '#000000',
    padding: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 0,
  },
  bioText: {
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 18,
  },
  verifiedBadge: {
    backgroundColor: '#000000',
    borderColor: '#00FF66',
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 0,
    marginTop: 10,
  },
  verifiedText: {
    color: '#00FF66',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
