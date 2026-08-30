import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export const api = async (path: string, options: RequestInit = {}) => {
  const token = await AsyncStorage.getItem('session_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const url = `${BASE_URL}/api${path}`;
  const response = await fetch(url, { ...options, headers });
  return response;
};

export const setToken = async (token: string) => {
  await AsyncStorage.setItem('session_token', token);
};

export const getToken = async () => {
  return await AsyncStorage.getItem('session_token');
};

export const clearToken = async () => {
  await AsyncStorage.removeItem('session_token');
};
