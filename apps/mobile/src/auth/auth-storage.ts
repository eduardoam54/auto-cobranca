import AsyncStorage from '@react-native-async-storage/async-storage';

const accessTokenKey = '@auto-cobranca/access-token';

export function getStoredAccessToken() {
  return AsyncStorage.getItem(accessTokenKey);
}

export function setStoredAccessToken(token: string) {
  return AsyncStorage.setItem(accessTokenKey, token);
}

export function clearStoredAccessToken() {
  return AsyncStorage.removeItem(accessTokenKey);
}
