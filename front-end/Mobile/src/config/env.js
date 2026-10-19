import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = 8000;
const DEFAULT_HOST = '192.168.1.3';

/**
 * Resolución automática del host del backend:
 * 1. Si se define EXPO_PUBLIC_API_URL (.env) se usa tal cual (override explícito).
 * 2. En desarrollo (Expo Go / dev build), hostUri contiene la IP de la máquina
 *    que levanta Metro, así el app se conecta igual en emulador y dispositivo físico
 *    de la misma red, aunque la IP cambie.
 * 3. Fallback a debuggerHost / manifest (SDK antiguos) para no quedar atado a
 *    una IP LAN hardcodeada que expira y causa 'fetch failed: timed out' en iOS.
 * 4. En Android emulator sin hostUri, 10.0.2.2 es la forma de llegar al host.
 * 5. Último recurso: la IP LAN por defecto.
 *
 * Todo el tráfico Mobile pasa por el gateway Kong (:8000). Los puertos directos
 * de microservicios (:8083, :8084, ...) no se publican en todos los entornos
 * (ms-identity expone solo 8081/tcp interno) y el firewall del dispositivo los
 * bloquea, lo que dejaba el login colgado en los 3 roles.
 */
function resolveHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }

  const debuggerHost =
    Constants.manifest?.debuggerHost ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (typeof debuggerHost === 'string') {
    const host = debuggerHost.split(':')[0];
    if (host) return host;
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return DEFAULT_HOST;
}

function resolveBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;

  return `http://${resolveHost()}:${API_PORT}/`;
}

function resolveServiceUrl(envName, port) {
  const explicit = process.env[envName];
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;

  return `http://${resolveHost()}:${port}/`;
}

const ENV = {
  API_BASE_URL: resolveBaseUrl(),
  // Compat: antes apuntaba directo a ms-authorization (:8083). Ahora alias del
  // gateway para no romper imports, pero el login ya no lo usa.
  AUTHZ_BASE_URL: resolveBaseUrl(),
  ACADEMIC_BASE_URL: resolveBaseUrl(),
  ATTENDANCE_BASE_URL: resolveBaseUrl(),
  SCHEDULING_BASE_URL: resolveBaseUrl(),
  NOTIFY_BASE_URL: resolveBaseUrl(),
  API_TIMEOUT: 15000,
  API_HEALTH_PATH: 'api/v1/health',
};

export default ENV;