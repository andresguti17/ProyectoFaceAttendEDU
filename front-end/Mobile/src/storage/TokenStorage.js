import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
import {jwtDecode} from "jwt-decode";

const TOKEN_KEY = "auth_token";

// En nativo el token vive en el keystore/Keychain (expo-secure-store); en web esa
// librería no está disponible, así que se cae a AsyncStorage con la misma forma.
const useSecureStore = Platform.OS !== 'web';

async function readPayload() {
  if (useSecureStore) {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (stored) return stored;

    // Migración de sesiones guardadas en AsyncStorage antes del keystore.
    const legacy = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacy);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    return legacy;
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function writePayload(raw) {
  if (useSecureStore) {
    await SecureStore.setItemAsync(TOKEN_KEY, raw);
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY, raw);
}

async function clearPayload() {
  if (useSecureStore) await SecureStore.removeItemAsync(TOKEN_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/**
 * Guarda la sesión con la forma compartida con Web:
 * { token, savedAt, expiresAt, email }.
 */
export const saveToken = async (token, email = null) => {
  if (!token || typeof token !== 'string') {
    console.warn("saveToken: token inválido");
    return false;
  }

  // El backend emite session ids opacos (UUID), no JWT: solo se intenta
  // decodificar cuando el token tiene forma de JWT (header.payload.signature).
  let expiresAt = null;
  if (token.split('.').length === 3) {
    try {
      const decoded = jwtDecode(token);
      expiresAt = decoded.exp ? decoded.exp * 1000 : null;
      if (expiresAt && expiresAt <= Date.now()) {
        console.warn("saveToken: token expirado");
        return false;
      }
    } catch (e) {
      console.warn("saveToken: JWT ilegible:", e.message);
    }
  }

  const data = { token, savedAt: Date.now(), expiresAt, email: email || null };
  await writePayload(JSON.stringify(data));
  console.log("saveToken: token guardado exitosamente");
  return true;
};

export const getToken = async () => {
  try {
    const raw = await readPayload();
    if (!raw) return null;

    const { token, expiresAt } = JSON.parse(raw);
    if (!token) return null;

    if (expiresAt && Date.now() > expiresAt) {
      await removeToken();
      return null;
    }

    return token;
  } catch {
    return null;
  }
};

/** Sesión guardada completa ({ token, savedAt, expiresAt, email }) o null si no hay. */
export const getSession = async () => {
  try {
    const raw = await readPayload();
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.token ? data : null;
  } catch {
    return null;
  }
};

export const removeToken = async () => {
  try {
    await clearPayload();
    return true;
  } catch {
    return false;
  }
};

export const hasValidToken = async () => {
  return (await getToken()) !== null;
};
