import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../../utils/i18n';

const LANGUAGE_KEY = (role) => `language_${role}`;

export const saveLanguageForRole = async (role, language) => {
    if (!role || !language) return;

    try {
        await AsyncStorage.setItem(LANGUAGE_KEY(role), language);
        await AsyncStorage.setItem('appLanguage', language);
        console.log(`✅ Idioma guardado: ${role} → ${language}`);
    } catch (error) {
        console.error('Error guardando idioma:', error);
    }
};

export const restoreLanguageForRole = async (role, fallback = 'es') => {
    if (!role) return fallback;

    try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY(role));
        const languageToUse = savedLanguage || fallback;

        console.log(`🔄 Restaurando idioma: ${languageToUse} (guardado: ${savedLanguage})`);

        if (i18n.language !== languageToUse) {
            await i18n.changeLanguage(languageToUse);
        }

        return languageToUse;
    } catch (error) {
        console.error('Error restaurando idioma:', error);
        return fallback;
    }
};

export const getLanguageForRole = async (role) => {
    if (!role) return null;
    try {
        return await AsyncStorage.getItem(LANGUAGE_KEY(role));
    } catch (error) {
        return null;
    }
};