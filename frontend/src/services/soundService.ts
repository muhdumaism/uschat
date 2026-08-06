import { Audio } from 'expo-av';
import { Vibration, Platform } from 'react-native';

let ringtoneSound: Audio.Sound | null = null;
let messageSound: Audio.Sound | null = null;

// Pre-configure audio mode for call ringing and high priority notification alerts
try {
  Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground: true,
  });
} catch (e) {
  console.warn('Audio mode config error:', e);
}

export const SoundService = {
  /**
   * Play continuous ringtone and strong vibration pattern for incoming or outgoing calls
   */
  playRingtone: async (isIncoming: boolean) => {
    try {
      await SoundService.stop();

      // Trigger continuous vibration pattern: wait 0ms, vibrate 800ms, pause 500ms (repeated)
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 800, 500], true);
      }

      // Reliable ringtone tone
      const source = isIncoming
        ? { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' } // Modern Incoming Call Ringtone
        : { uri: 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3' }; // Ringback Dial Tone

      const { sound } = await Audio.Sound.createAsync(
        source,
        {
          shouldPlay: true,
          isLooping: true,
          volume: 1.0,
        }
      );

      ringtoneSound = sound;
    } catch (err) {
      console.warn('[SoundService] Failed to play call sound:', err);
    }
  },

  /**
   * Play short notification sound & light vibration for incoming messages
   */
  playMessageSound: async () => {
    try {
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 150]);
      }

      if (messageSound) {
        await messageSound.unloadAsync().catch(() => {});
        messageSound = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' }, // Modern Chat Notification Pop
        { shouldPlay: true, volume: 0.8 }
      );

      messageSound = sound;
    } catch (err) {
      console.warn('[SoundService] Failed to play message sound:', err);
    }
  },

  /**
   * Stop any currently playing call or message sounds and cancel vibration
   */
  stop: async () => {
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    if (ringtoneSound) {
      try {
        await ringtoneSound.stopAsync();
        await ringtoneSound.unloadAsync();
      } catch (err) {
        // already unloaded
      }
      ringtoneSound = null;
    }

    if (messageSound) {
      try {
        await messageSound.unloadAsync();
      } catch (err) {
        // ignore
      }
      messageSound = null;
    }
  },
};
