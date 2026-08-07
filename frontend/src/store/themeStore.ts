import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeState {
  isDarkMode: boolean;
  toggleTheme: () => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: false,
  toggleTheme: async () => {
    set((state) => {
      const nextMode = !state.isDarkMode;
      AsyncStorage.setItem('@uschat/themeMode', nextMode ? 'dark' : 'light');
      return { isDarkMode: nextMode };
    });
  },
  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem('@uschat/themeMode');
      set({ isDarkMode: saved === 'dark' });
    } catch (e) {
      console.warn('Failed to load theme:', e);
    }
  },
}));
