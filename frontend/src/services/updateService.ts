import { Platform, Linking, NativeModules } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../api/config';

export interface VersionInfo {
  latestVersion: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
}

export const CURRENT_VERSION_CODE = 103; // Starting fresh at v1.0.3
export const CURRENT_VERSION_NAME = '1.0.3';

export const UpdateService = {
  /**
   * Check backend for latest version metadata
   */
  checkUpdateAvailable: async (): Promise<VersionInfo | null> => {
    try {
      const response = await axios.get<VersionInfo>(`${API_BASE_URL}/app/version`, { timeout: 5000 });
      const data = response.data;

      if (data && data.versionCode > CURRENT_VERSION_CODE) {
        return data;
      }
      return null;
    } catch (err: any) {
      console.warn('[UpdateService] Version check failed:', err.message);
      return null;
    }
  },

  /**
   * Download APK to local cache reporting progress, then launch native installer activity.
   */
  downloadAndInstallApk: async (
    downloadUrl: string,
    onProgress?: (percent: number) => void
  ): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem('@uschat/token');
      const secureUrl = token ? `${downloadUrl}?token=${token}` : downloadUrl;
      
      const localPath = `${FileSystem.cacheDirectory}uschat_update.apk`;
      console.log('[UpdateService] Downloading APK to local directory:', localPath);

      // Clean up old update file if exists
      try {
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(localPath, { idempotent: true });
        }
      } catch (e) {
        // ignore
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        secureUrl,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          if (onProgress) {
            onProgress(Math.round(progress * 100));
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('Local file download failed');
      }

      console.log('[UpdateService] Download completed. Launching native installer...');

      if (Platform.OS === 'android' && NativeModules.USChatModule) {
        // Remove file:// prefix to obtain absolute file system path
        const absolutePath = result.uri.replace('file://', '');
        await NativeModules.USChatModule.installApk(absolutePath);
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('[UpdateService] Failed to download or install APK:', err.message);
      return false;
    }
  },
};
