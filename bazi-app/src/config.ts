import { Platform } from 'react-native';

const PROD_API = 'https://samsam010-bazi-backend.hf.space/api';
const LOCAL_API = Platform.OS === 'web'
  ? 'http://localhost:8000/api'
  : PROD_API;

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? LOCAL_API;
