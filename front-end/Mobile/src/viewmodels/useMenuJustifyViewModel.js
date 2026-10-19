import {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {saveLanguageForRole} from '../view/components/common/languageByRole';
import {getCurrentUserRole} from "../services/UserService";
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {JustificationService} from '../services/JustificationService';

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

export function useMenuJustifyViewModel() {
    const navigation = useNavigation();
    const { t, i18n } = useTranslation();

    const [userRole, setUserRole] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);
    const updateKey = useLanguageRefresh();

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                try {
                    const role = await getCurrentUserRole();
                    if (!role) {
                        console.error('useMenuJustify: sin rol de usuario verificado');
                        setUserRole(null);
                        setPendingCount(0);
                        return;
                    }
                    setUserRole(role);
                    await saveLanguageForRole(role);

                    const pending = (await JustificationService.getPending()).length;
                    setPendingCount(pending);
                } catch (error) {
                    console.error('Error loading data:', error);
                    setUserRole(null);
                }
            };
            loadData();
        }, [])
    );

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);
    const handleValidJustifications = useCallback(() => navigation.navigate('ValidJustifications'), [navigation]);
    const handlePendingJustificationScreen = useCallback(() => navigation.navigate('PendingJustificationScreen'), [navigation]);
    const handleJustificationTypes = useCallback(() => navigation.navigate('JustificationTypes'), [navigation]);

    const handleAddOrEditJustify = useCallback(() => {
        if (!userRole) {
            console.error('useMenuJustify: sin rol verificado, no se navega');
            return;
        }
        const lower = String(userRole).toLowerCase();
        const screenName = (lower.includes('aprendiz') || lower.includes('estud')) ? 'AddJustification' : 'AddValidJustification';
        navigation.navigate(screenName);
    }, [navigation, userRole]);

    return {
        userRole, pendingCount, updateKey,
        handleBack, handleAddOrEditJustify, handleValidJustifications, handlePendingJustificationScreen, handleJustificationTypes,
    };
}
