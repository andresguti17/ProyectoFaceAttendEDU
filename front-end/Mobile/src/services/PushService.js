import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendDelete, backendGet, backendPost } from '../api/backend';
import ENV from '../config/env';
import i18n from '../utils/i18n';
import { isJustificationResultAlert } from '../utils/justificationLink';

// Push de las alertas de 08-notification (Expo Push). El backend redacta el texto
// en el locale del token y envía data: { alertId, code }.
export const PUSH_STORAGE_KEY = 'pushRegistration';
export const PUSH_CHANNEL_ID = 'alerts';
const TOKENS_PATH = 'api/v1/device-tokens';
const LOCALES = ['es', 'en', 'pt', 'fr'];

const toLocale = (lng) => {
  const base = String(lng || '').slice(0, 2);
  return LOCALES.includes(base) ? base : 'es';
};

// Con la app abierta también se muestra el banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Expo Go en Android no entrega push (SDK 53+) y la web no aplica.
const pushSupported = () => Platform.OS !== 'web'
  && !(Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient');

async function readCache() {
  try {
    return JSON.parse(await AsyncStorage.getItem(PUSH_STORAGE_KEY));
  } catch {
    return null;
  }
}

async function sendToken(token, locale) {
  await backendPost(ENV.NOTIFY_BASE_URL, TOKENS_PATH, { token, platform: Platform.OS, locale });
  await AsyncStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify({ token, locale }));
}

/**
 * Tras el login: canal Android, permiso (solo se pide si nunca se respondió;
 * `beforeRequest` explica el porqué antes del diálogo del sistema) y registro del token.
 * Nunca lanza: { status: 'unsupported' | 'denied' | 'registered' | 'error' }.
 */
export async function registerForPush({ beforeRequest } = {}) {
  if (!Device.isDevice || !pushSupported()) return { status: 'unsupported' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
        name: i18n.t('news.title'),
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined') {
      if (beforeRequest) await beforeRequest();
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return { status: 'denied' };

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await sendToken(token, toLocale(i18n.language));
    return { status: 'registered', token };
  } catch (e) {
    // Sin red o backend caído: se reintenta en el próximo login; Novedades sigue funcionando.
    console.warn('Push registration failed:', e?.message || e);
    return { status: 'error' };
  }
}

/** Cierre de sesión: el dispositivo deja de recibir las alertas de este usuario. */
export async function unregisterPush() {
  const cached = await readCache();
  await AsyncStorage.removeItem(PUSH_STORAGE_KEY);
  if (!cached?.token) return;
  try {
    await backendDelete(ENV.NOTIFY_BASE_URL, `${TOKENS_PATH}/${encodeURIComponent(cached.token)}`);
  } catch (e) {
    console.warn('Push unregister failed:', e?.message || e);
  }
}

/** El texto de la push sale en el locale del token: se reenvía al cambiar de idioma. */
export async function syncPushLocale(lng = i18n.language) {
  const cached = await readCache();
  const locale = toLocale(lng);
  if (!cached?.token || cached.locale === locale) return;
  try {
    await sendToken(cached.token, locale);
  } catch {
    // El próximo login lo reenvía.
  }
}

i18n.on('languageChanged', (lng) => { void syncPushLocale(lng); });

/**
 * Pantalla que abre el toque en una push. Como en Novedades, el resultado de una
 * justificación lleva al aprendiz a ese detalle, enlazado por la fecha de la alerta.
 */
export async function routeForNotification(response, userRole) {
  const { alertId, code } = response?.notification?.request?.content?.data ?? {};
  if (userRole !== 'Aprendiz' || !isJustificationResultAlert({ code })) return { name: 'Novedades' };
  const [alert] = alertId == null
    ? []
    : await backendGet(ENV.NOTIFY_BASE_URL, `api/v1/alerts/${encodeURIComponent(alertId)}`).catch(() => []);
  return { name: 'ValidJustifications', params: alert?.raised_at ? { reviewedAt: alert.raised_at } : undefined };
}
