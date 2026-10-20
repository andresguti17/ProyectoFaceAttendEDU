import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../services/api/authApi";
import { academicApi } from "../services/api/academicApi";
import { roleDisplayLabel } from "../core/utils/backendRoles";
import {
    profileFormFrom,
    hasProfileChanges,
    validateProfile,
    buildProfilePayload,
    mapProfileError,
    emailChanged,
} from "../core/utils/profileForm";

// ── useProfileViewModel ──────────────────────────────────────
// Perfil de la persona en sesión: datos de la cuenta en solo lectura y los
// campos que ella misma puede editar (PUT /api/v1/auth/me/profile).

export function useProfileViewModel() {
    const { t } = useTranslation();
    const { user, updateSessionUser } = useAuth();

    const [person, setPerson] = useState(null);
    const [school, setSchool] = useState(null);
    const [values, setValues] = useState(() => profileFormFrom(null));
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [saved, setSaved] = useState(false);

    const personId = user?.personId ?? null;
    const schoolId = user?.schoolId ?? null;
    const sessionEmail = user?.email ?? null;

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!personId) {
                if (!cancelled) {
                    setLoadError(t("Tu cuenta no tiene una persona asociada"));
                    setLoading(false);
                }
                return;
            }
            try {
                const [loaded, loadedSchool] = await Promise.all([
                    authApi.getPerson(personId),
                    schoolId != null ? academicApi.getSchool(schoolId).catch(() => null) : null,
                ]);
                if (cancelled) return;
                setPerson(loaded);
                setSchool(loadedSchool);
                setValues(profileFormFrom(loaded));
            } catch (err) {
                if (!cancelled) setLoadError(err?.message || t("No se pudo cargar tu perfil"));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
        // t cambia de identidad con el idioma; la carga no depende de él.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [personId, schoolId]);

    const setField = useCallback((field, value) => {
        setValues((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
        setSubmitError("");
        setSaved(false);
    }, []);

    const discard = useCallback(() => {
        setValues(profileFormFrom(person));
        setErrors({});
        setSubmitError("");
        setSaved(false);
    }, [person]);

    const save = useCallback(async () => {
        if (saving || !person) return false;
        const found = validateProfile(values, person, t);
        setErrors(found);
        if (Object.keys(found).length > 0) return false;

        setSaving(true);
        setSubmitError("");
        try {
            const updated = await authApi.updateMyProfile(buildProfilePayload(values, person));
            setPerson(updated);
            setValues(profileFormFrom(updated));
            updateSessionUser?.({ email: updated?.email ?? sessionEmail });
            setSaved(true);
            return true;
        } catch (err) {
            const mapped = mapProfileError(err, t);
            if (mapped.field) setErrors({ [mapped.field]: mapped.message });
            else setSubmitError(mapped.message);
            return false;
        } finally {
            setSaving(false);
        }
    }, [saving, person, values, t, updateSessionUser, sessionEmail]);

    const fullName = person
        ? `${person.name ?? ""} ${person.lastName ?? ""}`.trim()
        : user?.name ?? "";

    return {
        loading,
        loadError,
        saving,
        saved,
        submitError,
        errors,
        values,
        // Solo lectura: lo cambia la administración.
        account: {
            fullName,
            documentType: person?.documentType ?? "",
            documentNumber: person?.documentNumber ?? "",
            username: user?.username ?? "",
            roleLabel: user ? roleDisplayLabel(user) : "",
            schoolName: school?.name ?? "",
        },
        dirty: person ? hasProfileChanges(values, person) : false,
        needsPassword: person ? emailChanged(values, person) : false,
        setField,
        discard,
        save,
    };
}
