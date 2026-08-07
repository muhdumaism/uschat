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
import { Camera, User, FileText, LogOut, ArrowLeft, ShieldAlert } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { BrutalistTextInput } from '../../components/BrutalistTextInput';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../store/authStore';
import { apiClient, API_BASE_URL } from '../../api/client';

export const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const { colors, isDarkMode } = useBrutalistTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      {/* Header */}
      <View style={styles.header}>
        <BrutalistButton
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accentColor={colors.yellow}
        >
          <ArrowLeft size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
        </BrutalistButton>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>MY PROFILE</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Profile Card Summary */}
        <BrutalistCard accentColor={colors.cardBg} padding={16} style={styles.avatarCard}>
          <View style={styles.avatarRow}>
            {/* Square Bezel Avatar Box */}
            <View style={[styles.avatarBezel, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Avatar name={user?.displayName || user?.username || 'User'} uri={avatarUrl} size={84} />
              {uploadingImage && (
                <View style={[styles.uploadOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }]}>
                  <ActivityIndicator color={colors.textPrimary} size="small" />
                </View>
              )}
            </View>

            <View style={styles.metaInfo}>
              <Text style={[styles.usernameText, { color: colors.textPrimary }]}>@{user?.username?.toUpperCase()}</Text>
              <Text style={[styles.emailText, { color: colors.textSecondary }]}>{user?.email}</Text>
              <BrutalistButton onPress={handlePickAvatar} style={styles.cameraBtn} accentColor={colors.yellow}>
                <Camera size={12} color="#000000" style={{ marginRight: 6 }} />
                <Text style={styles.btnText}>PHOTO</Text>
              </BrutalistButton>
            </View>
          </View>
        </BrutalistCard>

        {/* Profile Form Form Card */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PERSONAL DETAILS</Text>
        <BrutalistCard accentColor={colors.cardBg} padding={16} style={styles.formCard}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>DISPLAY NAME</Text>
          <BrutalistTextInput
            placeholder="DISPLAY NAME"
            value={displayName}
            onChangeText={setDisplayName}
            icon={<User size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} />}
            containerStyle={{ marginBottom: 16 }}
          />

          <Text style={[styles.label, { color: colors.textPrimary }]}>BIO / STATUS PACKET</Text>
          <BrutalistTextInput
            placeholder="Tell others about yourself..."
            value={bio}
            onChangeText={setBio}
            icon={<FileText size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} />}
            containerStyle={{ marginBottom: 20 }}
          />

          <BrutalistButton
            title={loading ? "SAVING..." : "SAVE PROFILE"}
            onPress={handleSaveProfile}
            disabled={loading}
            accentColor={colors.yellow}
          />
        </BrutalistCard>

        {/* Security Warning Box */}
        <BrutalistCard accentColor={colors.blue} padding={12} style={styles.securityCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <ShieldAlert size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.securityTitle}>ACCOUNT VERIFIED</Text>
          </View>
          <Text style={styles.securitySub}>
            Private keys verified. Chats are fully encrypted end-to-end.
          </Text>
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
    marginBottom: 10,
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
    paddingBottom: 40,
  },
  avatarCard: {
    marginBottom: 8,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBezel: {
    width: 90,
    height: 90,
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaInfo: {
    marginLeft: 16,
    flex: 1,
  },
  usernameText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  emailText: {
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 2,
    marginBottom: 8,
  },
  cameraBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    height: 28,
  },
  btnText: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    fontWeight: 'bold',
    color: '#000000',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    marginTop: 14,
    marginBottom: 8,
    paddingLeft: 4,
  },
  formCard: {
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    marginBottom: 4,
  },
  securityCard: {
    marginBottom: 16,
  },
  securityTitle: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#FFFFFF',
  },
  securitySub: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#EEEEEE',
  },
  logoutBtn: {
    flexDirection: 'row',
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
