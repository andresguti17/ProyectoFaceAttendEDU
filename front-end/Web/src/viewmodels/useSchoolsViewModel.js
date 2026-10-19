// ============================================================
//  FaceAttend EDU — Schools ViewModel
// ============================================================
//  RESPONSABILIDAD: Gestión de escuelas del super admin ("qué hacer")
//
//  ✓ Lista las sedes desde ms-academic (CRUD + activar/desactivar)
//  ✓ Resume la asistencia de cada sede agrupando a sus aprendices
//    (mismo cálculo en cliente que ya usa Reportes por sede)
//  ✓ Valida y guarda el formulario de la sede
//
//  NO debe:
//  ✗ Renderizar UI (responsabilidad de la View)
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../context/AppDataContext";
import { useRolePermissions } from "./useRolePermissions";
import { academicApi } from "../services/api";

// Umbral de asistencia mínima (mismo criterio de "en riesgo" que Reportes).
export const ATTENDANCE_THRESHOLD = 75;

export const EMPTY_SCHOOL_FORM = {
    name: "",
    code: "",
    address: "",
    cityName: "",
    phone: "",
    email: "",
};

export function validateSchoolForm(form, isEdit) {
    if (!form.name?.trim()) return "El nombre de la sede es obligatorio.";
    // ms-academic exige código al crear; en edición es opcional (PUT parcial).
    if (!isEdit && !form.code?.trim()) return "El código de la sede es obligatorio.";
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        return "El correo electrónico no es válido.";
    // Ciudad: nombre del catálogo externo, elegido en el dropdown de texto
    // (la columna city_name del modelo admite 100 caracteres).
    if (String(form.cityName ?? "").length > 100)
        return "El nombre de la ciudad no puede superar los 100 caracteres.";
    return null;
}

export function useSchoolsViewModel() {
    const { t } = useTranslation();
    const appData = useAppData();
    const permissions = useRolePermissions();
    const students = appData.students;

    const [schools, setSchools] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(null); // { type, message }
    const [search, setSearch] = useState("");

    // Modal de creación/edición
    const [modalMode, setModalMode] = useState("none"); // "none" | "create" | "edit"
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_SCHOOL_FORM);
    const [formError, setFormError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Confirmación de activar/desactivar
    const [statusTarget, setStatusTarget] = useState(null);
    const [isToggling, setIsToggling] = useState(false);

    // Igual que el resto de la app: la carga inicial se dispara al montar y
    // sincroniza estado dentro de la promesa.
    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Sin limit/offset ms-academic devuelve la lista completa de sedes.
            const list = await academicApi.listSchools();
            setSchools(Array.isArray(list) ? list : list?.content ?? []);
        } catch (e) {
            setError(e?.message || t("No se pudieron cargar las sedes."));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Asistencia por sede (mismo cálculo en cliente que Reportes) ──
    // El porcentaje es el promedio de la asistencia de los aprendices con
    // sede asignada; se agrupa por schoolId para cruzar con ms-academic.
    const statsBySchool = useMemo(() => {
        const bySchool = new Map();
        let unassigned = 0;
        for (const s of students) {
            const key = s.schoolId ?? "sin-sede";
            if (s.schoolId == null) unassigned += 1;
            const entry =
                bySchool.get(key) ??
                { total: 0, active: 0, atRisk: 0, attendanceSum: 0 };
            entry.total += 1;
            if (s.status === "active") entry.active += 1;
            if (s.attendance < ATTENDANCE_THRESHOLD) entry.atRisk += 1;
            entry.attendanceSum += s.attendance || 0;
            bySchool.set(key, entry);
        }
        return { bySchool, unassigned };
    }, [students]);

    // Sedes con sus métricas unidas (una sede sin aprendices se lista igual,
    // con totales en cero y asistencia "—").
    const schoolRows = useMemo(
        () =>
            schools.map((school) => {
                const entry =
                    statsBySchool.bySchool.get(String(school.schoolId)) ?? null;
                return {
                    ...school,
                    students: entry?.total ?? 0,
                    active: entry?.active ?? 0,
                    atRisk: entry?.atRisk ?? 0,
                    avgAttendance:
                        entry && entry.total
                            ? Math.round(entry.attendanceSum / entry.total)
                            : null,
                };
            }),
        [schools, statsBySchool]
    );

    const filteredSchools = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return schoolRows;
        return schoolRows.filter((s) =>
            [s.name, s.code, s.cityName, s.address]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(needle))
        );
    }, [schoolRows, search]);

    // ── KPIs globales ────────────────────────────────────────
    const stats = useMemo(() => {
        const activeSchools = schoolRows.filter((s) => s.status).length;
        const withAttendance = students.filter((s) => s.status === "active");
        const avgAttendance = withAttendance.length
            ? Math.round(
                  withAttendance.reduce((sum, s) => sum + (s.attendance || 0), 0) /
                      withAttendance.length
              )
            : 0;
        return { total: schoolRows.length, activeSchools, avgAttendance };
    }, [schoolRows, students]);

    // ── Acciones del modal ───────────────────────────────────
    const openCreate = useCallback(() => {
        setEditing(null);
        setForm(EMPTY_SCHOOL_FORM);
        setFormError(null);
        setModalMode("create");
    }, []);

    const openEdit = useCallback((school) => {
        setEditing(school);
        setForm({
            name: school.name ?? "",
            code: school.code ?? "",
            address: school.address ?? "",
            cityName: school.cityName ?? "",
            phone: school.phone ?? "",
            email: school.email ?? "",
        });
        setFormError(null);
        setModalMode("edit");
    }, []);

    const closeModal = useCallback(() => {
        setModalMode("none");
        setEditing(null);
        setFormError(null);
    }, []);

    const setField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const save = useCallback(async () => {
        const isEdit = modalMode === "edit";
        const validationError = validateSchoolForm(form, isEdit);
        if (validationError) {
            setFormError(t(validationError));
            return;
        }
        setIsSaving(true);
        setFormError(null);
        try {
            const payload = {
                name: form.name.trim(),
                code: form.code?.trim() || undefined,
                address: form.address?.trim() || undefined,
                cityName: form.cityName?.trim() || undefined,
                phone: form.phone?.trim() || undefined,
                email: form.email?.trim() || undefined,
            };
            if (isEdit) {
                await academicApi.updateSchool(editing.schoolId, payload);
            } else {
                await academicApi.createSchool(payload);
            }
            setModalMode("none");
            setEditing(null);
            setFeedback({
                type: "success",
                message: isEdit ? t("Sede actualizada correctamente.") : t("Sede creada correctamente."),
            });
            await load();
        } catch (e) {
            setFormError(e?.message || t("No se pudo guardar la sede."));
        } finally {
            setIsSaving(false);
        }
    }, [modalMode, form, editing, load, t]);

    // ── Activar / desactivar sede ────────────────────────────
    const requestStatusChange = useCallback((school) => setStatusTarget(school), []);

    const confirmStatusChange = useCallback(async () => {
        const school = statusTarget;
        if (!school) return;
        setIsToggling(true);
        try {
            const next = !school.status;
            await academicApi.updateSchoolStatus(school.schoolId, next);
            setStatusTarget(null);
            setFeedback({
                type: "success",
                message: next ? t("Sede activada.") : t("Sede desactivada."),
            });
            await load();
        } catch (e) {
            setFeedback({
                type: "error",
                message: e?.message || t("No se pudo cambiar el estado de la sede."),
            });
            setStatusTarget(null);
        } finally {
            setIsToggling(false);
        }
    }, [statusTarget, load, t]);

    return {
        isLoading,
        error,
        clearError: () => setError(null),
        feedback,
        clearFeedback: () => setFeedback(null),
        // Lista y búsqueda
        schools: filteredSchools,
        search,
        setSearch,
        // Métricas
        stats,
        unassignedStudents: statsBySchool.unassigned,
        // Permisos
        canManage: permissions.canManageSchools,
        // Crear / editar
        modalMode,
        editing,
        form,
        setField,
        formError,
        isSaving,
        openCreate,
        openEdit,
        closeModal,
        save,
        // Estado
        statusTarget,
        requestStatusChange,
        confirmStatusChange,
        closeStatusConfirm: () => setStatusTarget(null),
        isToggling,
    };
}
