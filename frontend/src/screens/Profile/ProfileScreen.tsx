import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Camera, User, FileText, Mail, LogOut, Check, ShieldCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { GlassCard } from '../../components/GlassCard';
import { GlassInput } from '../../components/GlassInput';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { COLORS } from '../../theme/colors';
import { useAuthStore } from '../../store/authStore';
import { apiClient, API_BASE_URL } from '../../api/client';

export const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const { user, updateUser, logout, token } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Gallery access is required to choose a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setUploadingImage(true);
        const imageUri = result.assets[0].uri;

        const formData = new FormData();
        const filename = imageUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri: imageUri,
          name: filename,
          type,
        } as any);

        const response = await fetch(`${API_BASE_URL}/media/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const rawText = await response.text();
        let uploadRes: any;
        try {
          uploadRes = JSON.parse(rawText);
        } catch {
          Alert.alert('Upload Error', 'Failed to upload profile photo');
          return;
        }

        if (uploadRes?.fileUrl) {
          setAvatarUrl(uploadRes.fileUrl);
        } else {
          Alert.alert('Upload Failed', uploadRes?.message || 'Error uploading photo');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to select avatar');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.patch('/users/profile', {
        displayName: displayName.trim() || user?.username,
        bio: bio.trim(),
        avatarUrl: avatarUrl || null,
      });

      updateUser({
        displayName: res.data.displayName,
        bio: res.data.bio,
        avatarUrl: res.data.avatarUrl,
      });

      Alert.alert('Profile Saved', 'Your profile details have been updated successfully!');
    } catch (err: any) {
      Alert.alert('Save Failed', err.response?.data?.message || 'Unable to save profile changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Notch clearance spacer */}
      <View style={styles.statusBarSpacer} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar Container */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarCircle}>
            <Avatar name={user?.displayName || user?.username || 'User'} uri={avatarUrl} size={110} />
            {uploadingImage && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color="#FFF" size="large" />
              </View>
            )}
            <TouchableOpacity activeOpacity={0.8} onPress={handlePickAvatar} style={styles.cameraBadge}>
              <Camera size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.usernameText}>@{user?.username}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>
        </View>

        {/* Profile Edit Card */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardSectionTitle}>Personal Info</Text>

          <View style={styles.inputGap}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <GlassInput
              placeholder="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              icon={<User size={18} color={COLORS.textMuted} />}
            />
          </View>

          <View style={styles.inputGap}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <GlassInput
              placeholder="Tell others about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              icon={<FileText size={18} color={COLORS.textMuted} />}
            />
          </View>

          <Button
            title="Save Profile Changes"
            onPress={handleSaveProfile}
            loading={loading}
            style={styles.saveBtn}
          />
        </GlassCard>

        {/* Security & System Info */}
        <GlassCard style={[styles.card, { marginTop: 16 }]}>
          <View style={styles.infoRow}>
            <ShieldCheck size={20} color={COLORS.success} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoTitle}>End-to-End Encryption Active</Text>
              <Text style={styles.infoSub}>Your Signal E2EE Key Pair is stored locally on this device.</Text>
            </View>
          </View>
        </GlassCard>

        {/* Logout */}
        <TouchableOpacity activeOpacity={0.8} onPress={logout} style={styles.logoutBtn}>
          <LogOut size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Log Out of USCHAT</Text>
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
  avatarWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    position: 'relative',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    borderColor: COLORS.background,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
  },
  emailText: {
    color: COLORS.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    padding: 20,
  },
  cardSectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputGap: {
    marginBottom: 16,
  },
  saveBtn: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  infoSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 40,
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
