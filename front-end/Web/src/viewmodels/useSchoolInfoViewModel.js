// ============================================================
//  FaceAttend EDU — SchoolInfo ViewModel
// ============================================================
//  RESPONSABILIDAD: Información de la sede (nav-map /school-info)
//
//  ✓ Lectura para todos los roles (matriz de acceso)
//  ✓ Edición solo para administrador (HU-ACAD / school info edit)
//
//  ms-academic expone code, name, cityId, cityName, address,
//  phone, email y status: district/country siguen sin mapearse
//  (existen en el modelo relacional pero no forman parte de la
//  API de sedes).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRolePermissions } from "./useRolePermissions";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { academicApi } from "../services/api";
import { getActiveSchool } from "../services/api/referenceData";

export function useSchoolInfoViewModel() {
    const { user } = useAuth();
    const permissions = useRolePermissions();
    const { t } = useTranslation();

    const schoolId = user?.schoolId ?? getActiveSchool();

    const [school, setSchool] = useState(null);
    // Sedes consultables cuando la cuenta no tiene una asignada (p. ej. el
    // administrador, que no es actor académico y llega con schoolId null).
    const [schools, setSchools] = useState([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState(null);
    const effectiveSchoolId = schoolId ?? selectedSchoolId ?? school?.schoolId ?? null;
    const canChooseSchool = schoolId == null && schools.length > 0;

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(null);

    const [editOpen, setEditOpen] = useState(false);
    const [form, setForm] = useState({});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Igual que el resto de la app (p. ej. useBiometricsViewModel): la carga
    // inicial se dispara al montar y sincroniza estado dentro de la promesa.
    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (schoolId != null) {
                setSchools([]);
                const data = await academicApi.getSchool(schoolId);
                setSchool(data);
                return;
            }
            const list = await academicApi.listSchools();
            const rows = Array.isArray(list) ? list : list?.content ?? [];
            // Sin sede propia NO se autoselecciona la primera de la lista: una
            // cuenta global (super admin) no pertenece a ninguna escuela, así
            // que la sede se elige explícitamente desde el selector.
            const chosen = selectedSchoolId ?? null;
            setSchools(rows);
            setSelectedSchoolId(chosen);
            setSchool(rows.find((s) => s.schoolId === chosen) ?? null);
        } catch (e) {
            setError(e?.message || t("No se pudo cargar la información de la sede."));
        } finally {
            setIsLoading(false);
        }
    }, [schoolId, selectedSchoolId, t]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectSchool = useCallback(
        (id) => {
            setSelectedSchoolId(id);
            setSchool(schools.find((s) => s.schoolId === id) ?? null);
            setEditOpen(false);
            setFeedback(null);
            setError(null);
        },
        [schools]
    );

    const openEdit = useCallback(() => {
        setForm({
            name: school?.name ?? "",
            code: school?.code ?? "",
            address: school?.address ?? "",
            cityName: school?.cityName ?? "",
            phone: school?.phone ?? "",
            email: school?.email ?? "",
        });
        setFeedback(null);
        setEditOpen(true);
    }, [school]);

    const closeEdit = useCallback(() => setEditOpen(false), []);

    const setField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const save = useCallback(async () => {
        if (!form.name?.trim()) {
            setFeedback({ type: "error", message: t("El nombre de la sede es obligatorio.") });
            return;
        }
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            setFeedback({ type: "error", message: t("El correo electrónico no es válido.") });
            return;
        }

        setIsSaving(true);
        setFeedback(null);
        try {
            const payload = {
                name: form.name.trim(),
                code: form.code?.trim() || undefined,
                address: form.address?.trim() || undefined,
                cityName: form.cityName?.trim() || undefined,
                phone: form.phone?.trim() || undefined,
                email: form.email?.trim() || undefined,
            };
            const updated = await academicApi.updateSchool(effectiveSchoolId, payload);
            setSchool(updated);
            setEditOpen(false);
            setFeedback({ type: "success", message: t("Información de la sede actualizada.") });
        } catch (e) {
            setFeedback({
                type: "error",
                message: e?.message || t("No se pudo actualizar la información de la sede."),
            });
        } finally {
            setIsSaving(false);
        }
    }, [form, effectiveSchoolId, t]);

    return {
        isLoading,
        // Sin sede que mostrar (y sin catálogo de sedes) se explica en la vista.
        error:
            error ||
            (schoolId == null && !isLoading && schools.length === 0
                ? t("Tu cuenta no tiene una sede asociada.")
                : null),
        feedback,
        clearFeedback: () => setFeedback(null),
        school,
        // Consulta/edición entre sedes cuando la cuenta no tiene una propia.
        canChooseSchool,
        schools,
        selectedSchoolId,
        selectSchool,
        canEdit: permissions.canEditSchoolInfo,
        editOpen,
        openEdit,
        closeEdit,
        form,
        setField,
        confirmOpen,
        setConfirmOpen,
        save,
        isSaving,
    };
}
