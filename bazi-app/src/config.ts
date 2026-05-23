import { Platform } from 'react-native';

const LOCAL_API = Platform.OS === 'web'
  ? 'http://localhost:8000/api'
  : 'http://192.168.1.180:8000/api';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? LOCAL_API;
