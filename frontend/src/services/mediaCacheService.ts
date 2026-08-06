import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const CACHE_FOLDER = `${FileSystem.cacheDirectory}media_cache/`;
const MAX_CACHE_SIZE = 200 * 1024 * 1024; // 200 MB

export const MediaCacheService = {
  /**
   * Determine the clean hash representation for a cached file path
   */
  getCachePath: async (url: string): Promise<string> => {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA1,
      url
    );
    const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
    return `${CACHE_FOLDER}${hash}.${ext}`;
  },

  /**
   * Resolve locally cached URI, fetching it if not already present
   */
  getCachedUri: async (url: string): Promise<string> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_FOLDER);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
      }

      const cachePath = await MediaCacheService.getCachePath(url);
      const fileInfo = await FileSystem.getInfoAsync(cachePath);

      if (fileInfo.exists) {
        return cachePath;
      }

      console.log('[Cache] Downloading media to cache:', url);
      const result = await FileSystem.downloadAsync(url, cachePath);
      
      // Asynchronously trigger eviction checks
      MediaCacheService.cleanOldCacheFiles();

      return result.uri;
    } catch (err: any) {
      console.warn('[Cache] Failed to cache file, fallback to network:', err.message);
      return url;
    }
  },

  /**
   * Clear old cache items when the threshold limit is reached
   */
  cleanOldCacheFiles: async (): Promise<void> => {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_FOLDER);
      let cacheFiles: Array<{ name: string; size: number; modificationTime: number }> = [];

      let totalSize = 0;
      for (const file of files) {
        const path = `${CACHE_FOLDER}${file}`;
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          totalSize += info.size;
          cacheFiles.push({
            name: file,
            size: info.size,
            modificationTime: info.modificationTime || Date.now(),
          });
        }
      }

      console.log('[Cache] Current cache size:', (totalSize / (1024 * 1024)).toFixed(1), 'MB');

      if (totalSize > MAX_CACHE_SIZE) {
        cacheFiles.sort((a, b) => a.modificationTime - b.modificationTime);

        let freedSize = 0;
        for (const file of cacheFiles) {
          if (totalSize - freedSize <= MAX_CACHE_SIZE * 0.7) {
            break;
          }
          await FileSystem.deleteAsync(`${CACHE_FOLDER}${file.name}`, { idempotent: true });
          freedSize += file.size;
          console.log('[Cache] Evicted file:', file.name);
        }
      }
    } catch (err: any) {
      console.warn('[Cache] Failed to clean cache:', err.message);
    }
  }
};
