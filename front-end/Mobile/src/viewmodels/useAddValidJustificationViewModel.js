import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {JustificationService} from '../services/JustificationService';

export function useAddValidJustificationViewModel() {
    const navigation = useNavigation();
    const {t} = useTranslation();
    // Con { typeToEdit } (desde el catálogo de tipos) el formulario edita en vez de crear.
    const editing = useRoute().params?.typeToEdit || null;

    const [type, setType] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [requiresDocument, setRequiresDocument] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const updateKey = useLanguageRefresh();

    const [alertData, setAlertData] = useState({
        message: null,
        type: 'warning',
        timestamp: 0,
    });
    const clearAlert = () => setAlertData({message: null, type: 'warning', timestamp: 0});

    const categories = useMemo(() => [
        { id: 'salud', label: t('admin.categoryHealth'), icon: '🏥', description: t('admin.categoryHealthDesc') },
        { id: 'familiar', label: t('admin.categoryFamily'), icon: '👨‍👩‍👧', description: t('admin.categoryFamilyDesc') },
        { id: 'legal', label: t('admin.categoryLegal'), icon: '⚖️', description: t('admin.categoryLegalDesc') },
        { id: 'academica', label: t('admin.categoryAcademic'), icon: '🎓', description: t('admin.categoryAcademicDesc') },
        { id: 'otro', label: t('admin.categoryOther'), icon: '📋', description: t('admin.categoryOtherDesc') },
    ], [t]);

    const types = useMemo(() => [
        { id: 'medica', label: t('admin.typeMedical'), icon: '💊', description: t('admin.typeMedicalDesc') },
        { id: 'familiar', label: t('admin.typeFamily'), icon: '🏠', description: t('admin.typeFamilyDesc') },
        { id: 'personal', label: t('admin.typePersonal'), icon: '👤', description: t('admin.typePersonalDesc') },
        { id: 'academica', label: t('admin.typeAcademic'), icon: '📚', description: t('admin.typeAcademicDesc') },
        { id: 'laboral', label: t('admin.typeWork'), icon: '💼', description: t('admin.typeWorkDesc') },
        { id: 'otro', label: t('admin.typeOther'), icon: '📝', description: t('admin.typeOtherDesc') },
    ], [t]);

    useEffect(() => {
        if (!editing) return;
        setType(editing.type);
        setDescription(editing.description);
        setRequiresDocument(editing.requiresDocument);
        // La categoría es solo de la interfaz (el backend no la guarda).
        setCategory((current) => current || categories[categories.length - 1].label);
    }, [editing, categories]);

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    const handleSave = useCallback(async () => {
        if (!type.trim() || !description.trim() || !category.trim()) {
            setAlertData({ message: t('admin.completeAllFields'), type: 'warning', timestamp: Date.now() });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name: type.trim(),
                description: description.trim(),
                requiresAttachment: requiresDocument,
            };
            if (editing) {
                await JustificationService.updateType(editing.id, payload);
            } else {
                await JustificationService.createType(payload);
            }

            setAlertData({ message: t(editing ? 'admin.justificationUpdated' : 'admin.justificationCreated'), type: 'success', timestamp: Date.now() });
        } catch (error) {
            setAlertData({ message: error?.message || t('admin.errorCreating'), type: 'error', timestamp: Date.now() });
        } finally {
            setIsSaving(false);
        }
    }, [type, description, category, requiresDocument, editing, t]);

    const selectedCategory = useMemo(() => categories.find(c => c.label === category), [categories, category]);
    const selectedType = useMemo(() => types.find(tp => tp.label === type), [types, type]);

    return {
        type, setType, description, setDescription, category, setCategory,
        requiresDocument, setRequiresDocument, isSaving, updateKey,
        categories, types, selectedCategory, selectedType,
        handleBack, handleSave, alertData, clearAlert, isEditing: !!editing,
    };
}
