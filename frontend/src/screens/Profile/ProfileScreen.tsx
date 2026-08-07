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
  Image,
} from 'react-native';
import { Camera, User, FileText, LogOut, ShieldAlert } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { RetroWindow } from '../../components/RetroWindow';
import { RetroButton } from '../../components/RetroButton';
import { RetroTextInput } from '../../components/RetroTextInput';
import { RetroPanel } from '../../components/RetroPanel';
import { Avatar } from '../../components/Avatar';
import { RETRO_COLORS, RETRO_STYLES } from '../../theme/retroTheme';
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
      <View style={styles.statusBarSpacer} />

      <RetroWindow
        title="USER_PROFILE.EXE"
        onClose={() => navigation.goBack()}
        contentStyle={styles.windowContent}
        style={styles.mainWindow}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Avatar Profile Box */}
          <RetroPanel raised style={styles.avatarPanel}>
            <View style={styles.avatarRow}>
              <View style={styles.avatarBezel}>
                <Avatar name={user?.displayName || user?.username || 'User'} uri={avatarUrl} size={90} />
                {uploadingImage && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator color="#FFF" size="small" />
                  </View>
                )}
              </View>
              
              <View style={styles.avatarMeta}>
                <Text style={styles.usernameText}>@{user?.username?.toUpperCase()}</Text>
                <Text style={styles.emailText}>{user?.email}</Text>
                <RetroButton onPress={handlePickAvatar} style={styles.cameraBtn}>
                  <Camera size={12} color="#000" style={{ marginRight: 6 }} />
                  <Text style={styles.btnText}>CHANGE PHOTO</Text>
                </RetroButton>
              </View>
            </View>
          </RetroPanel>

          {/* Edit Form */}
          <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
          <RetroPanel raised style={styles.formPanel}>
            <Text style={styles.label}>DISPLAY NAME</Text>
            <RetroTextInput
              placeholder="DISPLAY NAME"
              value={displayName}
              onChangeText={setDisplayName}
              icon={<User size={16} color="#000" />}
              containerStyle={{ marginBottom: 12 }}
            />

            <Text style={styles.label}>BIO / STATUS PACKET</Text>
            <RetroTextInput
              placeholder="Tell others about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              icon={<FileText size={16} color="#000" />}
              containerStyle={{ marginBottom: 16 }}
            />

            <RetroButton
              title={loading ? "SAVING..." : "OK (SAVE CHANGES)"}
              onPress={handleSaveProfile}
              disabled={loading}
            />
          </RetroPanel>

          {/* Security Info Card */}
          <RetroPanel raised style={styles.infoPanel}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ShieldAlert size={16} color="#000080" style={{ marginRight: 8 }} />
              <Text style={styles.infoTitle}>IDENTITY SECURITY ACTIVE</Text>
            </View>
            <Text style={styles.infoSub}>
              Cryptographic keys verified. Peer connections are isolated and secure.
            </Text>
          </RetroPanel>

          <RetroButton
            onPress={logout}
            style={styles.logoutBtn}
            textStyle={{ color: '#800000' }}
          >
            <LogOut size={14} color="#800000" style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>DISCONNECT ACCOUNT SESSION</Text>
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
  avatarPanel: {
    padding: 10,
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBezel: {
    width: 96,
    height: 96,
    backgroundColor: '#fff',
    ...RETRO_STYLES.borderSunken,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMeta: {
    marginLeft: 16,
    flex: 1,
    justifyContent: 'center',
  },
  usernameText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  emailText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#555',
    marginTop: 2,
    marginBottom: 8,
  },
  cameraBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  btnText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
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
  formPanel: {
    padding: 10,
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
    marginBottom: 4,
  },
  infoPanel: {
    padding: 10,
    marginBottom: 14,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000080',
  },
  infoSub: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#555',
    marginTop: 4,
    lineHeight: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
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
