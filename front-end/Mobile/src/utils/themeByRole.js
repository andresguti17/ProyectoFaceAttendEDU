import AsyncStorage from '@react-native-async-storage/async-storage';
import {resolvePaletteMode} from '../theme/palettes';

const THEME_KEY = (role) => `theme_${role}`;
const PALETTE_KEY = (role) => `palette_${role}`;

/** Guarda el tema actual vinculado al rol */
export const saveThemeForRole = async (role, theme) => {
    if (!role) return;
    await AsyncStorage.setItem(THEME_KEY(role), theme);
};

export const getThemeForRole = async (role, fallback = 'light') => {
    if (!role) return fallback;
    try {
        const saved = await AsyncStorage.getItem(THEME_KEY(role));
        return saved ?? fallback;
    } catch {
        return fallback;
    }
};

/** Guarda la paleta (modo de visión) vinculada al rol. Devuelve false si falla. */
export const savePaletteForRole = async (role, mode) => {
    if (!role) return false;
    try {
        await AsyncStorage.setItem(PALETTE_KEY(role), resolvePaletteMode(mode));
        return true;
    } catch (e) {
        console.error('Error guardando paleta:', e);
        return false;
    }
};

/** Lee la paleta del rol. Paleta ausente, inválida o con error → predeterminada. */
export const getPaletteForRole = async (role) => {
    if (!role) return resolvePaletteMode(undefined);
    try {
        return resolvePaletteMode(await AsyncStorage.getItem(PALETTE_KEY(role)));
    } catch (e) {
        console.error('Error leyendo paleta:', e);
        return resolvePaletteMode(undefined);
    }
};
