const normalizeUrl = (url) => url.replace(/\/+$/, '');

const resolveApiBaseUrl = () => {
  const envUrl =
    typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_URL : undefined;

  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return normalizeUrl(envUrl.trim());
  }

  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  if (isDev) {
    return 'http://localhost:3001';
  }

  return 'https://nova-versao-liga-do-bem-api.onrender.com';
};

export const API_BASE_URL = resolveApiBaseUrl();
export const API_BASE_PATH = `${API_BASE_URL}/api`;

