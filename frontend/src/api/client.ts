import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

export { API_BASE_URL };

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@uschat/token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('401 Unauthorized received. Logging out user...');
      await AsyncStorage.removeItem('@uschat/token');
      await AsyncStorage.removeItem('@uschat/refreshToken');
      await AsyncStorage.removeItem('@uschat/user');
      const { useAuthStore } = require('../store/authStore');
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
