import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { DownloadCloud, Sparkles, CheckCircle2, Pause, Play, EyeOff } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassCard } from './GlassCard';
import { COLORS } from '../theme/colors';
import { UpdateService, VersionInfo, CURRENT_VERSION_NAME, DownloadProgressInfo } from '../services/updateService';

export const UpdateModal: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStats, setDownloadStats] = useState<DownloadProgressInfo | null>(null);
  const [downloadedUri, setDownloadedUri] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const initUpdate = async () => {
      // 1. Check if there is a saved download state in storage
      const savedDownload = await AsyncStorage.getItem('@uschat/download_savable');
      const info = await UpdateService.checkUpdateAvailable();

      if (info) {
        setUpdateInfo(info);
        setVisible(true);

        if (savedDownload) {
          setIsDownloading(true);
          setIsPaused(true);
          try {
            const parsed = JSON.parse(savedDownload);
            const percent = Math.round((parsed.fileOffset / (info.fileSize || 1)) * 100);
            setDownloadProgress(percent || 0);
          } catch (e) {}
        }
      }
    };
    initUpdate();
  }, []);

  if (!visible || !updateInfo) return null;

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setIsPaused(false);

    const uri = await UpdateService.startOrResumeDownload(
      updateInfo.downloadUrl,
      updateInfo.sha256,
      (stats) => {
        setDownloadProgress(stats.percent);
        setDownloadStats(stats);
      }
    );

    if (uri) {
      setDownloadedUri(uri);
      setIsDownloading(false);
    } else {
      const active = UpdateService.getActiveDownload();
      if (!active) {
        setIsDownloading(false);
        Alert.alert(
          'Download Interrupted',
          'Failed to complete download. Please check your network and try again.'
        );
      }
    }
  };

  const handlePause = async () => {
    await UpdateService.pauseDownload();
    setIsPaused(true);
  };

  const handleResume = () => {
    handleStartDownload();
  };

  const handleUpdateApp = async () => {
    if (!downloadedUri) return;
    try {
      await UpdateService.installDownloadedApk(downloadedUri, updateInfo.sha256);
    } catch (err: any) {
      Alert.alert('Installation Blocked', err.message || 'Verification failed.');
      await UpdateService.cancelDownload();
      setDownloadedUri(null);
    }
  };

  const handleBackground = () => {
    setVisible(false);
    Alert.alert(
      'Downloading in Background',
      'The update will continue downloading in the background. We will notify you when it is ready!'
    );
  };

  const handleDismiss = async () => {
    if (!updateInfo.forceUpdate) {
      await UpdateService.cancelDownload();
      setVisible(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <GlassCard style={styles.card}>
          <View style={styles.iconContainer}>
            <Sparkles size={32} color={COLORS.accent} />
          </View>

          <Text style={styles.title}>Update Available</Text>
          <View style={styles.versionBadgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Current: v{CURRENT_VERSION_NAME}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={[styles.badge, styles.badgeActive]}>
              <Text style={[styles.badgeText, styles.badgeTextActive]}>New: v{updateInfo.latestVersion}</Text>
            </View>
          </View>

          <Text style={styles.notesHeader}>What's New in this Upgrade:</Text>
          <Text style={styles.releaseNotes}>{updateInfo.releaseNotes}</Text>

          {downloadedUri ? (
            <View style={styles.readySection}>
              <CheckCircle2 size={38} color={COLORS.success} style={{ marginBottom: 12 }} />
              <Text style={styles.readyTitle}>Upgrade File Verified ✓</Text>
              <Text style={styles.readySub}>This upgrade will overwrite your current app. All chats, databases, and preferences will be preserved intact.</Text>
              <TouchableOpacity
                onPress={handleUpdateApp}
                style={styles.installBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.installText}>Ready to Update</Text>
              </TouchableOpacity>
            </View>
          ) : isDownloading ? (
            <View style={styles.progressSection}>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
              </View>
              <View style={styles.progressDetailRow}>
                <Text style={styles.progressText}>{downloadProgress}% Downloaded</Text>
                {downloadStats && (
                  <Text style={styles.statsText}>{downloadStats.downloadSpeed}</Text>
                )}
              </View>
              {downloadStats && (
                <Text style={styles.remainingText}>{downloadStats.remainingTime}</Text>
              )}

              <View style={styles.controlRow}>
                {isPaused ? (
                  <TouchableOpacity onPress={handleResume} style={styles.controlBtn}>
                    <Play size={18} color="#FFF" />
                    <Text style={styles.controlText}>Resume</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handlePause} style={styles.controlBtn}>
                    <Pause size={18} color="#FFF" />
                    <Text style={styles.controlText}>Pause</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleBackground} style={[styles.controlBtn, styles.bgBtn]}>
                  <EyeOff size={18} color={COLORS.textSecondary} />
                  <Text style={[styles.controlText, { color: COLORS.textSecondary }]}>Background</Text>
                </TouchableOpacity>
              </View>
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
                onPress={handleStartDownload}
                style={[styles.updateButton, updateInfo.forceUpdate && { flex: 1 }]}
                activeOpacity={0.8}
              >
                <DownloadCloud size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.updateText}>Download Now</Text>
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
    backgroundColor: 'rgba(5, 7, 13, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    backgroundColor: COLORS.secondaryBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  versionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  badgeActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  badgeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: COLORS.accent,
  },
  arrow: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  notesHeader: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  releaseNotes: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  progressSection: {
    width: '100%',
    marginTop: 8,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  progressDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  progressText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  statsText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '600',
  },
  remainingText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'left',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 12,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
    gap: 6,
  },
  bgBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  controlText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  readySection: {
    alignItems: 'center',
    width: '100%',
  },
  readyTitle: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  readySub: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  installBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  installText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
