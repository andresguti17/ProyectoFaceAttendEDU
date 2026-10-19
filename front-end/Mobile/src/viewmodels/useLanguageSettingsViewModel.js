import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {saveLanguageForRole} from '../view/components/common/languageByRole';
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {getCurrentUserRole} from "../services/UserService";

export function useLanguageSettingsViewModel() {
    const {t, i18n} = useTranslation();
    const navigation = useNavigation();

    const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
    const [isLoading, setIsLoading] = useState(false);

    const updateKey = useLanguageRefresh();

    // ---- Estado de alerta centralizado ----
    const [alertData, setAlertData] = useState({
        message: null,
        type: 'warning',
        timestamp: 0,
    });

    const clearAlert = useCallback(() => {
        setAlertData({message: null, type: 'warning', timestamp: 0});
    }, []);

    // Lista de idiomas
    const languages = useMemo(() => [
        {code: 'es', name: 'Español', flag: '🇪🇸'},
        {code: 'en', name: 'English', flag: '🇬🇧'},
        {code: 'fr', name: 'Français', flag: '🇫🇷'},
        {code: 'pt', name: 'Português', flag: '🇵🇹'},
    ], []);

    // Sincronizar idioma cuando cambia externamente
    useEffect(() => {
        if (i18n.language !== selectedLanguage) {
            setSelectedLanguage(i18n.language);
        }
    }, [i18n.language]);

    // Acción de guardar (solo idioma — el tema/acento se gestiona en AppearanceSettingsScreen)
    const handleSave = useCallback(async () => {
        setIsLoading(true);
        try {
            const role = await getCurrentUserRole();
            if (!role) {
                setAlertData({
                    message: t('settings.noRoleError'),
                    type: 'error',
                    timestamp: Date.now(),
                });
                return;
            }

            if (i18n.language !== selectedLanguage) {
                await i18n.changeLanguage(selectedLanguage);
            }

            await saveLanguageForRole(role, selectedLanguage);

            await new Promise(resolve => setTimeout(resolve, 100));

            setAlertData({
                message: t('settings.languageChanged'),
                type: 'success',
                timestamp: Date.now(),
            });
        } catch (error) {
            console.error('Error guardando idioma:', error);
            setAlertData({
                message: t('settings.errorChangingLanguage'),
                type: 'error',
                timestamp: Date.now(),
            });
        } finally {
            setIsLoading(false);
        }
    }, [selectedLanguage, i18n, t]);

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    return {
        selectedLanguage,
        setSelectedLanguage,
        isLoading,
        updateKey,
        languages,
        handleSave,
        handleBack,
        alertData,
        clearAlert,
    };
}
