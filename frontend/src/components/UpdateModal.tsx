import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { DownloadCloud, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { COLORS } from '../theme/colors';
import { UpdateService, VersionInfo } from '../services/updateService';

export const UpdateModal: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check for updates on startup
    const checkUpdate = async () => {
      const info = await UpdateService.checkUpdateAvailable();
      if (info) {
        setUpdateInfo(info);
        setVisible(true);
      }
    };
    checkUpdate();
  }, []);

  if (!visible || !updateInfo) return null;

  const handleStartUpdate = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);

    const success = await UpdateService.downloadAndInstallApk(
      updateInfo.downloadUrl,
      (progress) => {
        setDownloadProgress(progress);
      }
    );

    setIsDownloading(false);

    if (!success) {
      Alert.alert(
        'Update Failed',
        'Could not download the update file. Please check your internet connection and try again.'
      );
    }
  };

  const handleDismiss = () => {
    if (!updateInfo.forceUpdate) {
      setVisible(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <GlassCard style={styles.card}>
          <View style={styles.iconContainer}>
            <Sparkles size={32} color={COLORS.accent} />
          </View>

          <Text style={styles.title}>New Update Available</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v{updateInfo.latestVersion}</Text>
          </View>

          <Text style={styles.notesHeader}>What's New:</Text>
          <Text style={styles.releaseNotes}>{updateInfo.releaseNotes}</Text>

          {isDownloading ? (
            <View style={styles.progressSection}>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{downloadProgress}% Downloaded...</Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              {!updateInfo.forceUpdate && (
                <TouchableOpacity
                  onPress={handleDismiss}
                  style={styles.laterButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.laterText}>Later</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleStartUpdate}
                style={[styles.updateButton, updateInfo.forceUpdate && { flex: 1 }]}
                activeOpacity={0.8}
              >
                <DownloadCloud size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.updateText}>Update Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  versionBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  versionText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  notesHeader: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  releaseNotes: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  progressText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  laterButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laterText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  updateButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
