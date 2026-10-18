import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import * as DocumentPicker from 'expo-document-picker';
import {JustificationService, mapConcurrent} from '../services/JustificationService';
import {backendGet} from '../api/backend';
import ENV from '../config/env';
import {getCurrentUser} from '../services/UserService';
import {ActorService} from '../services/ActorService';
import {SUPPORT_FILE_MIME_TYPES, validateSupportFile} from '../utils/validators';
import {byRecordDateDesc, eligibleRecords} from '../utils/justificationEligibility';
import {useCustomAlert} from '../view/components/common/useCustomAlert';

export function useAddJustificationViewModel() {
    const navigation = useNavigation();
    const {t} = useTranslation();
    const {alertConfig, hideAlert, showSuccess, showError, showWarning} = useCustomAlert();

    // Estados del formulario
    const [records, setRecords] = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(true);
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [description, setDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Idioma: usar hook universal
    const updateKey = useLanguageRefresh();

    // HU-JUS-001 AC1: inasistencias y retardos propios aún sin justificar.
    // El backend acota registros y justificaciones a los actores del usuario.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const user = await getCurrentUser();
                const actors = await ActorService.getByPerson(user?.personId);
                const actor = actors?.[0];
                const [attendance, justifications] = actor
                    ? await Promise.all([
                        backendGet(ENV.ATTENDANCE_BASE_URL, 'api/v1/attendance-records', {academicActorId: actor.academicActorId}),
                        JustificationService.getAll(),
                    ])
                    : [[], []];
                // La fecha real de cada registro es la de su sesión de clase.
                const pending = await mapConcurrent(eligibleRecords(attendance, justifications), async (record) => {
                    const [session] = record.class_session_id
                        ? await backendGet(ENV.SCHEDULING_BASE_URL, `api/v1/class-sessions/${record.class_session_id}`).catch(() => [])
                        : [];
                    return {...record, session_date: session?.session_date ?? null};
                });
                if (active) setRecords(pending.sort(byRecordDateDesc));
            } catch {
                if (active) showError(t('common.error'), t('justify.loadRecordsError'));
            } finally {
                if (active) setRecordsLoading(false);
            }
        })();
        return () => { active = false; };
        // Solo al montar: showError cambia en cada render (useCustomAlert no lo memoiza de forma estable).
    }, []);

    const pickFile = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: SUPPORT_FILE_MIME_TYPES,
            copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const file = result.assets[0];
        const problem = validateSupportFile(file);
        if (problem) {
            showWarning(t('justify.title'), t(problem === 'size' ? 'justify.fileTooLarge' : 'justify.invalidFileFormat'));
            return;
        }
        setSelectedFile(file);
    };

    // Navegación hacia atrás
    const handleBack = () => navigation.goBack();

    // Envío del formulario
    const handleSubmit = async () => {
        const record = records.find((r) => r.attendance_record_id === selectedRecordId);
        if (!record) {
            showWarning(t('justify.title'), t('justify.selectRecordError'));
            return;
        }
        if (!description.trim()) {
            showWarning(t('justify.title'), t('justify.enterReason'));
            return;
        }
        if (!selectedFile) {
            showWarning(t('justify.title'), t('justify.missingAttachmentError'));
            return;
        }

        setIsLoading(true);
        try {
            const isLate = record.attendance_status === 'Late';
            const typeData = await backendGet(ENV.ATTENDANCE_BASE_URL, 'api/v1/justification-types', {});
            const types = typeData?.value || typeData || [];
            const type = types.find(item => {
                const name = String(item.name || '').toLowerCase();
                return isLate ? name.includes('ret') || name.includes('late') : name.includes('inas') || name.includes('absen');
            }) || types[0];

            const created = await JustificationService.create({
                attendanceRecordId: record.attendance_record_id,
                justificationTypeId: type?.justification_type_id || null,
                reason: description.trim(),
            });
            // El soporte es obligatorio para aprobar (RN-33): se registra como
            // documento de la justificación recién creada, igual que en web.
            const justificationId = created?.justificationId;
            if (justificationId) {
                const ext = String(selectedFile.name?.split('.').pop() || 'bin').toLowerCase();
                const now = new Date();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                await JustificationService.createDocument({
                    justificationId,
                    fileName: selectedFile.name,
                    storageUri: `justification-documents/${now.getFullYear()}/${month}/${Date.now()}.${ext}`,
                    mimeType: selectedFile.mimeType || 'application/octet-stream',
                    sizeBytes: selectedFile.size || 1,
                });
            }
            showSuccess(t('common.success'), t('justify.successMessage'), handleBack);
        } catch (error) {
            showError(t('common.error'), t('justify.submitError'));
        } finally {
            setIsLoading(false);
        }
    };

    return {
        records,
        recordsLoading,
        selectedRecordId,
        setSelectedRecordId,
        description,
        setDescription,
        selectedFile,
        pickFile,
        isLoading,
        updateKey,
        handleBack,
        handleSubmit,
        alertConfig,
        hideAlert,
    };
}
