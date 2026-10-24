// Push de alertas: registro del token tras el login, baja en el logout y locale del texto.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { backendDelete, backendGet, backendPost } from '../../api/backend';
import i18n from '../../utils/i18n';
import { PUSH_STORAGE_KEY, registerForPush, routeForNotification, unregisterPush } from '../PushService';
import appConfig from '../../../app.json';

jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));
jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));
// Como en un build: expoConfig sale de app.json (el mock de jest-expo no trae extra).
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: require('../../../app.json').expo, executionEnvironment: 'bare' },
}));
jest.mock('../../api/backend', () => ({ backendPost: jest.fn(), backendDelete: jest.fn(), backendGet: jest.fn() }));

const TOKEN = 'ExponentPushToken[abc123]';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const cached = async () => JSON.parse(await AsyncStorage.getItem(PUSH_STORAGE_KEY));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await i18n.changeLanguage('es');
  Device.isDevice = true;
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN });
  backendPost.mockResolvedValue({ device_token_id: 1 });
  backendDelete.mockResolvedValue(null);
});

test('en un simulador no pide permiso ni registra nada', async () => {
  Device.isDevice = false;

  expect(await registerForPush()).toEqual({ status: 'unsupported' });
  expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  expect(backendPost).not.toHaveBeenCalled();
});

test('permiso denegado: no lo vuelve a pedir, no lanza y no registra', async () => {
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });

  expect(await registerForPush()).toEqual({ status: 'denied' });
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(backendPost).not.toHaveBeenCalled();
});

test('primera vez: explica, pide el permiso y registra el token con plataforma e idioma', async () => {
  await i18n.changeLanguage('en');
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  const beforeRequest = jest.fn(async () => {});

  expect(await registerForPush({ beforeRequest })).toEqual({ status: 'registered', token: TOKEN });

  expect(beforeRequest).toHaveBeenCalledTimes(1);
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: appConfig.expo.extra.eas.projectId });
  expect(backendPost).toHaveBeenCalledWith(expect.any(String), 'api/v1/device-tokens', { token: TOKEN, platform: Platform.OS, locale: 'en' });
  expect(await cached()).toEqual({ token: TOKEN, locale: 'en' });
});

test('sin red: el error se traga y no queda en caché (se reintenta en el próximo login)', async () => {
  backendPost.mockRejectedValue(Object.assign(new Error('Network request failed'), { status: 0 }));
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  expect(await registerForPush()).toEqual({ status: 'error' });
  expect(await cached()).toBeNull();
});

test('al cambiar de idioma reenvía el token con el nuevo locale', async () => {
  await registerForPush();
  backendPost.mockClear();

  await i18n.changeLanguage('pt');
  await flush();

  expect(backendPost).toHaveBeenCalledWith(expect.any(String), 'api/v1/device-tokens', { token: TOKEN, platform: Platform.OS, locale: 'pt' });
  expect(await cached()).toEqual({ token: TOKEN, locale: 'pt' });
});

test('logout: borra el token en el backend y la caché', async () => {
  await registerForPush();

  await unregisterPush();

  expect(backendDelete).toHaveBeenCalledWith(expect.any(String), `api/v1/device-tokens/${encodeURIComponent(TOKEN)}`);
  expect(await cached()).toBeNull();
});

test('logout sin red: limpia la caché igual y no lanza', async () => {
  await registerForPush();
  backendDelete.mockRejectedValue(new Error('Network request failed'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  await expect(unregisterPush()).resolves.toBeUndefined();
  expect(await cached()).toBeNull();
});

describe('toque en la push', () => {
  const tap = (data) => ({ notification: { request: { identifier: 'n-1', content: { data } } } });

  test('el resultado de una justificación abre ese detalle al aprendiz', async () => {
    backendGet.mockResolvedValue([{ alert_id: 10, raised_at: '2026-10-17T15:43:53.123Z' }]);

    expect(await routeForNotification(tap({ alertId: 10, code: 'JUSTIFICATION_APPROVED' }), 'Aprendiz'))
      .toEqual({ name: 'ValidJustifications', params: { reviewedAt: '2026-10-17T15:43:53.123Z' } });
    expect(backendGet).toHaveBeenCalledWith(expect.any(String), 'api/v1/alerts/10');
  });

  test('cualquier otra alerta abre Novedades', async () => {
    expect(await routeForNotification(tap({ alertId: 11, code: 'ABSENCE_STREAK' }), 'Aprendiz')).toEqual({ name: 'Novedades' });
    expect(await routeForNotification(tap({ alertId: 10, code: 'JUSTIFICATION_APPROVED' }), 'Instructor')).toEqual({ name: 'Novedades' });
    expect(backendGet).not.toHaveBeenCalled();
  });
});
