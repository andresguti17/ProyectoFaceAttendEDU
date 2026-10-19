import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../view/components/common/ThemeContext';
import {getCurrentUserRole} from "../services/UserService";
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {JustificationService} from '../services/JustificationService';
import {useCustomAlert} from '../view/components/common/useCustomAlert';

// Identificadores estables; la pantalla los traduce (admin.category*).
const categoryOf = (name) =>
    /m[eé]d/i.test(name) ? 'health' :
    /familiar|calamidad/i.test(name) ? 'family' :
    /representaci[oó]n|institucional|academic/i.test(name) ? 'academic' : 'general';

// Catálogo de tipos de justificación (05-attendance), administrado por el Administrador.
export function useJustificationsViewModel() {
    const navigation = useNavigation();
    const {t} = useTranslation();
    const {loadThemeForRole} = useTheme();
    const {alertConfig, hideAlert, showError, showConfirm} = useCustomAlert();

    const [justifications, setJustifications] = useState([]);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const updateKey = useLanguageRefresh();

    useEffect(() => {
        getCurrentUserRole().then((role) => {
            setUserRole(role);
            if (role) loadThemeForRole(role);
        }).catch(() => {});
    }, [loadThemeForRole]);

    const loadJustifications = useCallback(async () => {
        setLoading(true);
        try {
            const types = await JustificationService.getTypes();
            setJustifications(types.map((type) => ({
                id: String(type.justification_type_id),
                type: type.name,
                description: type.description || '',
                requiresDocument: !!type.requires_attachment,
                category: categoryOf(type.name || ''),
            })));
        } catch (error) {
            showError(t('common.error'), error?.message || t('justifications.loadError'));
        } finally {
            setLoading(false);
        }
    }, [showError, t]);

    useEffect(() => {
        loadJustifications();
        return navigation.addListener('focus', loadJustifications);
    }, [navigation, loadJustifications]);

    const categories = useMemo(() => [...new Set(justifications.map(j => j.category))], [justifications]);
    const getJustificationsByCategory = useCallback(
        (cat) => justifications.filter(j => j.category === cat),
        [justifications]
    );

    const editType = useCallback((item) => navigation.navigate('AddValidJustification', {typeToEdit: item}), [navigation]);
    const createType = useCallback(() => navigation.navigate('AddValidJustification'), [navigation]);

    const deleteType = useCallback((item) => {
        showConfirm(t('justifications.deleteTypeTitle'), t('justifications.deleteTypeQuestion', {name: item.type}), async () => {
            try {
                await JustificationService.deleteType(item.id);
                setJustifications((prev) => prev.filter((j) => j.id !== item.id));
            } catch (error) {
                // 409/400: el tipo ya está referenciado por justificaciones radicadas.
                showError(t('common.error'), error?.message || t('justifications.deleteTypeError'));
            }
        });
    }, [showConfirm, showError, t]);

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    return {
        justifications, userRole, updateKey, categories, loading,
        getJustificationsByCategory, handleBack, editType, deleteType, createType,
        alertConfig, hideAlert,
    };
}
