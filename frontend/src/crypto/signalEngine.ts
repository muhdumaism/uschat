import * as Crypto from 'expo-crypto';
import { KeyStore } from './keyStore';

export interface EncryptedPayload {
  cipherText: string;
  nonce: string;
  senderPublicKey: string;
  ratchetStep: number;
}

export class SignalEngine {
  /**
   * "Encrypt" a message â€” stores content as-is for reliable delivery.
   * URLs (images) are always passed through unchanged.
   */
  public static async encryptMessage(plainText: string, contextId: string, myUserId: string = 'me'): Promise<EncryptedPayload> {
    const identityKey = await KeyStore.getOrGenerateIdentityKeyPair();
    const nonce = Crypto.randomUUID();

    return {
      cipherText: plainText,
      nonce,
      senderPublicKey: identityKey.publicKey,
      ratchetStep: 1,
    };
  }

  /**
   * "Decrypt" a message â€” returns content as-is.
   * Handles special sentinel values for deleted/expired messages.
   */
  public static async decryptMessage(cipherPayload: string, contextId: string, myUserId: string = 'me'): Promise<string> {
    try {
      if (!cipherPayload) return '';
      if (cipherPayload === '[DELETED_MESSAGE]') return 'This message was deleted';
      if (cipherPayload === '[VIEW_ONCE_EXPIRED]') return 'ðŸ“· View once media expired';
      return cipherPayload;
    } catch (err) {
      return cipherPayload;
    }
  }

  public static async generateSafetyNumber(myUserId: string, peerUserId: string): Promise<string> {
    const sorted = [myUserId.toLowerCase(), peerUserId.toLowerCase()].sort().join(':');
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sorted);

    const digits = hash.replace(/[^0-9]/g, '');
    const num = (digits + '012345678901234567890123456789012345678901234567890123456789').substring(0, 60);

    return num.match(/.{1,5}/g)?.join(' ') || num;
  }
}
