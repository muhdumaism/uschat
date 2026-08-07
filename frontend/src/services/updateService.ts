import { Platform, Linking, NativeModules } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../api/config';

export interface VersionInfo {
  latestVersion: string;
  versionCode: number;
  downloadUrl: string;
  sha256: string;
  fileSize: number;
  releaseNotes: string;
  forceUpdate: boolean;
}

export const CURRENT_VERSION_CODE = 200;
export const CURRENT_VERSION_NAME = '2.0.0';

export interface DownloadProgressInfo {
  percent: number;
  downloadSpeed: string; // e.g. "1.2 MB/s"
  remainingTime: string; // e.g. "25s remaining"
  downloadedBytes: number;
  totalBytes: number;
}

let activeResumable: FileSystem.DownloadResumable | null = null;
let lastBytesWritten = 0;
let lastTimestamp = 0;

export const UpdateService = {
  /**
   * Check backend for latest version metadata
   */
  checkUpdateAvailable: async (): Promise<VersionInfo | null> => {
    return null;
  },

  getActiveDownload: () => activeResumable,

  /**
   * Pause the active download and save state to AsyncStorage
   */
  pauseDownload: async (): Promise<void> => {
    if (activeResumable) {
      try {
        const pausedState = await activeResumable.pauseAsync();
        await AsyncStorage.setItem('@uschat/download_savable', JSON.stringify(pausedState));
        console.log('[UpdateService] Download paused successfully.');
      } catch (err: any) {
        console.error('[UpdateService] Pause error:', err.message);
      }
    }
  },

  /**
   * Cancel and clean up files
   */
  cancelDownload: async (): Promise<void> => {
    if (activeResumable) {
      try {
        await activeResumable.pauseAsync();
      } catch (e) {}
      activeResumable = null;
    }
    await AsyncStorage.removeItem('@uschat/download_savable');
    const localPath = `${FileSystem.cacheDirectory}uschat_update.apk`;
    try {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    } catch (e) {}
  },

  /**
   * Try restoring any saved download state from AsyncStorage
   */
  restoreDownload: async (
    onProgress: (info: DownloadProgressInfo) => void
  ): Promise<boolean> => {
    try {
      const savableStr = await AsyncStorage.getItem('@uschat/download_savable');
      if (!savableStr) return false;

      const savable = JSON.parse(savableStr);
      lastBytesWritten = savable.fileOffset || 0;
      lastTimestamp = Date.now();

      activeResumable = new FileSystem.DownloadResumable(
        savable.url,
        savable.fileUri,
        savable.options,
        (progressData: any) => {
          const now = Date.now();
          const duration = (now - lastTimestamp) / 1000;
          const bytesWritten = progressData.totalBytesWritten;
          const totalBytes = progressData.totalBytesExpectedToWrite;

          let speedStr = 'Calculating...';
          let remainingStr = 'Unknown';

          if (duration > 0.5) {
            const diff = bytesWritten - lastBytesWritten;
            const speedBytesPerSec = diff / duration;
            const speedMbPerSec = speedBytesPerSec / (1024 * 1024);
            speedStr = `${speedMbPerSec.toFixed(1)} MB/s`;

            if (speedBytesPerSec > 0) {
              const remainingBytes = totalBytes - bytesWritten;
              const remainingSecs = Math.round(remainingBytes / speedBytesPerSec);
              if (remainingSecs < 60) {
                remainingStr = `${remainingSecs}s remaining`;
              } else {
                remainingStr = `${Math.floor(remainingSecs / 60)}m ${remainingSecs % 60}s remaining`;
              }
            }
            lastBytesWritten = bytesWritten;
            lastTimestamp = now;
          }

          onProgress({
            percent: Math.round((bytesWritten / totalBytes) * 100),
            downloadSpeed: speedStr,
            remainingTime: remainingStr,
            downloadedBytes: bytesWritten,
            totalBytes,
          });
        },
        savableStr
      );

      console.log('[UpdateService] Restored paused download resumable.');
      return true;
    } catch (err: any) {
      console.warn('[UpdateService] Failed to restore download:', err.message);
      return false;
    }
  },

  /**
   * Starts or resumes the APK download resumable flow
   */
  startOrResumeDownload: async (
    downloadUrl: string,
    sha256: string,
    onProgress: (info: DownloadProgressInfo) => void
  ): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('@uschat/token');
      const secureUrl = token ? `${downloadUrl}?token=${token}` : downloadUrl;
      const localPath = `${FileSystem.cacheDirectory}uschat_update.apk`;

      const hasSaved = await UpdateService.restoreDownload(onProgress);
      if (!hasSaved || !activeResumable) {
        lastBytesWritten = 0;
        lastTimestamp = Date.now();
        activeResumable = FileSystem.createDownloadResumable(
          secureUrl,
          localPath,
          {},
          (progressData: any) => {
            const now = Date.now();
            const duration = (now - lastTimestamp) / 1000;
            const bytesWritten = progressData.totalBytesWritten;
            const totalBytes = progressData.totalBytesExpectedToWrite;

            let speedStr = 'Calculating...';
            let remainingStr = 'Unknown';

            if (duration > 0.5) {
              const diff = bytesWritten - lastBytesWritten;
              const speedBytesPerSec = diff / duration;
              const speedMbPerSec = speedBytesPerSec / (1024 * 1024);
              speedStr = `${speedMbPerSec.toFixed(1)} MB/s`;

              if (speedBytesPerSec > 0) {
                const remainingBytes = totalBytes - bytesWritten;
                const remainingSecs = Math.round(remainingBytes / speedBytesPerSec);
                if (remainingSecs < 60) {
                  remainingStr = `${remainingSecs}s remaining`;
                } else {
                  remainingStr = `${Math.floor(remainingSecs / 60)}m ${remainingSecs % 60}s remaining`;
                }
              }
              lastBytesWritten = bytesWritten;
              lastTimestamp = now;
            }

            onProgress({
              percent: Math.round((bytesWritten / totalBytes) * 100),
              downloadSpeed: speedStr,
              remainingTime: remainingStr,
              downloadedBytes: bytesWritten,
              totalBytes,
            });
          }
        );
      }

      const result = await activeResumable.downloadAsync();
      await AsyncStorage.removeItem('@uschat/download_savable');
      activeResumable = null;

      if (!result || !result.uri) {
        throw new Error('APK download failed');
      }

      return result.uri;
    } catch (err: any) {
      console.error('[UpdateService] Download failed:', err.message);
      return null;
    }
  },

  /**
   * Installs the downloaded APK and performs type safe validation check
   */
  installDownloadedApk: async (uri: string, sha256: string): Promise<boolean> => {
    if (Platform.OS === 'android' && NativeModules.USChatModule) {
      try {
        const absolutePath = uri.replace('file://', '');
        await NativeModules.USChatModule.installApk(absolutePath, sha256);
        return true;
      } catch (err: any) {
        console.error('[UpdateService] Native APK install failed:', err.message);
        throw err;
      }
    }
    return false;
  }
};
