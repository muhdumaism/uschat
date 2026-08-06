import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
}

const IDENTITY_KEY_STORAGE = '@uschat/identityKeyPair';

export class KeyStore {
  private static cachedKeyPair: IdentityKeyPair | null = null;

  /**
   * Returns the stored identity key pair, or generates and persists a new one.
   */
  public static async getOrGenerateIdentityKeyPair(): Promise<IdentityKeyPair> {
    if (KeyStore.cachedKeyPair) {
      return KeyStore.cachedKeyPair;
    }

    try {
      const stored = await AsyncStorage.getItem(IDENTITY_KEY_STORAGE);
      if (stored) {
        KeyStore.cachedKeyPair = JSON.parse(stored);
        return KeyStore.cachedKeyPair!;
      }
    } catch {
      // Fallthrough to generate
    }

    const keyPair: IdentityKeyPair = {
      publicKey: Crypto.randomUUID(),
      privateKey: Crypto.randomUUID(),
    };

    try {
      await AsyncStorage.setItem(IDENTITY_KEY_STORAGE, JSON.stringify(keyPair));
    } catch (err) {
      console.warn('Failed to persist identity key pair:', err);
    }

    KeyStore.cachedKeyPair = keyPair;
    return keyPair;
  }

  /**
   * Clear stored keys (e.g. on logout).
   */
  public static async clearKeys(): Promise<void> {
    KeyStore.cachedKeyPair = null;
    try {
      await AsyncStorage.removeItem(IDENTITY_KEY_STORAGE);
    } catch {
      // ignore
    }
  }
}
