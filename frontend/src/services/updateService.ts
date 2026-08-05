import { Platform, Linking } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api/config';

export interface VersionInfo {
  latestVersion: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
}

export const CURRENT_VERSION_CODE = 250; // Current app version code (v2.5.0)
export const CURRENT_VERSION_NAME = '2.5.0';

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
   * Trigger native APK download and installation prompt via Linking with secure query token
   */
  downloadAndInstallApk: async (
    downloadUrl: string,
    _onProgress?: (percent: number) => void
  ): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem('@uschat/token');
      const secureUrl = token ? `${downloadUrl}?token=${token}` : downloadUrl;
      await Linking.openURL(secureUrl);
      return true;
    } catch (err: any) {
      console.error('[UpdateService] Failed to open APK download link:', err.message);
      return false;
    }
  },
};
