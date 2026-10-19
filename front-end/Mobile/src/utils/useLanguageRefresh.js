import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

export const useLanguageRefresh = () => {
    const { i18n } = useTranslation();
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const handleLanguageChanged = (lng) => {
            setRefreshKey(prev => prev + 1);
        };

        i18n.on('languageChanged', handleLanguageChanged);
        return () => i18n.off('languageChanged', handleLanguageChanged);
    }, [i18n]);

    return refreshKey;
};