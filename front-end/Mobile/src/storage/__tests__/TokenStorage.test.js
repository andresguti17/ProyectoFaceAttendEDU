// La sesión vive en el keystore (expo-secure-store); las guardadas antes en AsyncStorage se migran.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {saveToken, getToken, getSession, removeToken, hasValidToken} from '../TokenStorage';

jest.mock('expo-secure-store', () => {
    const store = new Map();
    return {
        __store: store,
        getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
        setItemAsync: jest.fn(async (k, v) => {
            store.set(k, v);
        }),
        removeItemAsync: jest.fn(async (k) => {
            store.delete(k);
        }),
    };
});

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (payload) => `${b64url({alg: 'HS256'})}.${b64url(payload)}.firma`;

beforeEach(async () => {
    SecureStore.__store.clear();
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

test('an opaque session id is stored in the keystore with the shared shape', async () => {
    await expect(saveToken('a1b2-c3', 'ana@x.co')).resolves.toBe(true);

    const session = await getSession();
    expect(session).toMatchObject({token: 'a1b2-c3', email: 'ana@x.co', expiresAt: null});
    expect(typeof session.savedAt).toBe('number');
    expect(await getToken()).toBe('a1b2-c3');
    expect(await AsyncStorage.getItem('auth_token')).toBeNull();
    expect(await hasValidToken()).toBe(true);
});

test('invalid tokens are refused', async () => {
    expect(await saveToken('')).toBe(false);
    expect(await saveToken(42)).toBe(false);
    expect(await getToken()).toBeNull();
});

test('an already expired JWT is refused and a live one keeps its expiry', async () => {
    expect(await saveToken(jwt({exp: Math.floor(Date.now() / 1000) - 60}))).toBe(false);

    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(await saveToken(jwt({exp}))).toBe(true);
    expect((await getSession()).expiresAt).toBe(exp * 1000);
});

test('a stored session past its expiry is purged on read', async () => {
    await SecureStore.setItemAsync('auth_token', JSON.stringify({token: 't', expiresAt: Date.now() - 1}));

    expect(await getToken()).toBeNull();
    expect(SecureStore.__store.has('auth_token')).toBe(false);
});

test('a session saved in AsyncStorage before the keystore is migrated', async () => {
    await AsyncStorage.setItem('auth_token', JSON.stringify({token: 'legacy', savedAt: 1}));

    expect(await getToken()).toBe('legacy');
    expect(SecureStore.__store.get('auth_token')).toContain('legacy');
    expect(await AsyncStorage.getItem('auth_token')).toBeNull();
});

test('a corrupt payload reads as no session', async () => {
    await SecureStore.setItemAsync('auth_token', '{roto');

    expect(await getToken()).toBeNull();
    expect(await getSession()).toBeNull();
});

test('removeToken clears both stores and reports a failure', async () => {
    await saveToken('t');
    expect(await removeToken()).toBe(true);
    expect(await getToken()).toBeNull();

    SecureStore.removeItemAsync.mockRejectedValueOnce(new Error('keystore'));
    expect(await removeToken()).toBe(false);
});
