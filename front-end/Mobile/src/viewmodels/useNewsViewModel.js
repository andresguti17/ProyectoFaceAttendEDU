import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../view/components/common/ThemeContext';
import {getCurrentUserRole} from "../services/UserService";
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {AlertService} from '../services/AlertService';
import {loadScopedAlerts} from '../services/alertFeed';
import {isJustificationResultAlert} from '../utils/justificationLink';

// Novedades = alertas con alcance por rol; resolver es acción del staff (RBAC del backend).
export function useNewsViewModel() {
    const {t} = useTranslation();
    const navigation = useNavigation();
    const {loadThemeForRole} = useTheme();
    const updateKey = useLanguageRefresh();

    const [userRole, setUserRole] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resolvingId, setResolvingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const role = await getCurrentUserRole();
            setUserRole(role);
            if (role) await loadThemeForRole(role);
            const scoped = await loadScopedAlerts();
            setAlerts(scoped.map((a) => ({...a, title: a.title || t('news.alert')})));
        } catch (e) {
            console.error('Error cargando novedades:', e);
            setError(t('news.loadError'));
        } finally {
            setLoading(false);
        }
    }, [loadThemeForRole, t]);

    useEffect(() => {
        load();
    }, [load]);

    const resolve = useCallback(async (id) => {
        setResolvingId(id);
        try {
            await AlertService.markResolved(id);
            setAlerts((prev) => prev.map((a) => (a.id === id ? {...a, resolved: true} : a)));
        } catch (e) {
            setError(e?.message || t('news.resolveError'));
        } finally {
            setResolvingId(null);
        }
    }, [t]);

    // El resultado de una justificación es del aprendiz: su alerta abre el detalle (ERF 6.3).
    const canOpen = useCallback((alert) => userRole === 'Aprendiz' && isJustificationResultAlert(alert), [userRole]);
    const openAlert = useCallback((alert) => {
        if (canOpen(alert)) navigation.navigate('ValidJustifications', {reviewedAt: alert.raisedAt});
    }, [canOpen, navigation]);

    return {
        userRole,
        canOpen,
        openAlert,
        updateKey,
        alerts,
        loading,
        error,
        resolvingId,
        canResolve: userRole === 'Administrador' || userRole === 'Instructor',
        resolve,
        reload: load,
    };
}
