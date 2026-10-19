// ============================================================
//  FaceAttend EDU — RegisterStudentModal
//  Modal para registrar un nuevo estudiante.
//  Usa TextInput y AnimatedDropdown de componentes comunes.
//  La validación se hace en el ViewModel, no aquí.
// ============================================================

import React, { useState, useRef, useMemo } from "react";
import {
    View, Text, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, AnimatedDropdown, BaseModal, TextInput, PasswordInput } from "../common";
import { useTheme }               from "../hooks/useTheme";
import { useResponsive }          from "../hooks/useResponsive";
import { useTranslation }         from "../../../core/utils/i18n/hooks/useTranslation";
import { useAppData }             from "../../../context/AppDataContext";
import { useAuth }                from "../../../context/AuthContext";
import { academicApi }            from "../../../services/api/academicApi";
import { listActors }             from "../../../services/api/referenceData";
import FaceRegistrationModal      from "./FaceRegistrationModal";
import {
    EMPTY_FORM,
    validateStudentForm,
} from "../../../viewmodels/useStudentsViewModel";

// ── Roles disponibles ────────────────────────────────────

const ROLE_ITEMS = [
    { value: "admin",   label: "Administrador", description: "Admin",    icon: "shield"    },
    { value: "teacher", label: "Docente",       description: "Teacher",  icon: "book-open" },
    { value: "student", label: "Estudiante",    description: "Student",  icon: "user"      },
];

// ── Autogeneración de código de docente ──────────────────
// Correlativo "DOC-{sede}-NNN" (p. ej. DOC-ICT-041) a partir de los códigos
// ya existentes de la sede. El campo queda deshabilitado en el formulario.
function nextTeacherCode(actors, schoolShort) {
    const prefix = `DOC-${schoolShort}-`;
    let max = 0;
    for (const a of actors) {
        const code = String(a?.actorCode ?? "");
        if (!code.startsWith(prefix)) continue;
        const n = parseInt(code.slice(prefix.length), 10);
        if (!Number.isNaN(n) && n > max) max = n;
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// ── Componente principal ─────────────────────────────────

export default function RegisterStudentModal({
    visible,
    onClose,
    onSubmit,
    initialRole = null, // null = modo genérico, "student"/"teacher"/"admin" = modo específico
    getCohortsForCourse = null, // Fichas del curso (backend) para matrícula
}) {
    const { theme }   = useTheme();
    const { isSmall } = useResponsive();
    const { t }       = useTranslation();
    const c           = theme.colors;
    const appData     = useAppData();
    const { user }    = useAuth();
    // Admin de sede: su user.schoolId viene de su academic_actor y acota todo.
    // Super Admin (schoolId nulo) conserva la vista global y elige sede libre.
    const isScopedAdmin = user?.schoolId != null;

    const [form,          setForm]          = useState({ ...EMPTY_FORM, role: initialRole || "" });
    const [error,         setError]         = useState(null);
    const [saving,        setSaving]        = useState(false);
    const [showErrors,    setShowErrors]    = useState(false);
    const [success,       setSuccess]       = useState(false);
    const [showFaceModal, setShowFaceModal] = useState(false);
    const [fichaSearch,   setFichaSearch]   = useState(""); // Para búsqueda de fichas
    const [schoolItems,   setSchoolItems]   = useState([]); // Sedes (vínculo del admin)
    const [schoolsError,  setSchoolsError]  = useState(null);
    const [cohortItems,   setCohortItems]   = useState([]); // Fichas del curso (matrícula)
    const pendingFormRef = useRef(null);

    // Generar items de fichas desde los cursos disponibles
    const fichaItems = useMemo(() => {
        if (!appData.courses || appData.courses.length === 0) return [];

        // Los códigos se repiten entre sedes: se pinta uno solo por código.
        const seen = new Set();
        return appData.courses
            .filter(course => course.status === "active")
            .filter(course => {
                if (seen.has(course.code)) return false;
                seen.add(course.code);
                return true;
            })
            .map(course => ({
                value: course.code,
                label: course.name,
                description: `Ficha ${course.code}`,
                icon: "book-open",
            }));
    }, [appData.courses]);

    // Filtrar fichas según búsqueda
    const filteredFichaItems = useMemo(() => {
        if (!fichaSearch.trim()) return fichaItems.slice(0, 5); // Máximo 5 por defecto
        
        const query = fichaSearch.toLowerCase();
        return fichaItems
            .filter(item => 
                item.label.toLowerCase().includes(query) ||
                item.value.toLowerCase().includes(query)
            )
            .slice(0, 5); // Máximo 5 resultados
    }, [fichaItems, fichaSearch]);

    // Calcular código estudiantil auto-incremental cuando se selecciona una ficha
    // Formato: códigoCurso + "00" + n (ej: "AED-401001", "AED-401002", ..., "AED-40120", etc.)
    // donde "00" es fijo y "n" es el número incremental (1, 2, 3, ..., 20, ..., 100)
    const generateStudentCode = (fichaCode) => {
        if (!fichaCode || !appData.students) return "";
        
        // Buscar todos los estudiantes que pertenecen a esta ficha
        // El patrón esperado es: fichaCode + "00" + n
        const prefix = `${fichaCode}00`;
        const studentsInFicha = appData.students.filter(s => 
            s.code && s.code.startsWith(prefix)
        );
        
        // Extraer el número "n" de cada código y encontrar el máximo
        let maxNumber = 0;
        studentsInFicha.forEach(s => {
            // Remover el prefijo completo (fichaCode + "00") y obtener solo el número incremental
            const numberPart = s.code.substring(prefix.length);
            const num = parseInt(numberPart, 10);
            if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
            }
        });
        
        // Incrementar (1, 2, 3, ..., 20, ..., 100)
        const nextNumber = maxNumber + 1;
        
        // Formato final: fichaCode + "00" + nextNumber
        return `${fichaCode}00${nextNumber}`;
    };

    // Sedes para el vínculo del administrador (actor ADMIN).
    React.useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        setSchoolsError(null);
        academicApi.listSchools().then(
            (list) => {
                if (cancelled) return;
                const rows = Array.isArray(list) ? list : list?.content ?? [];
                setSchoolItems(
                    rows
                        .map((s) => ({
                            value: String(s?.schoolId ?? s?.school_id ?? ""),
                            label: s?.name ?? s?.code ?? "",
                            description: s?.code ?? "",
                            icon: "map-pin",
                        }))
                        .filter((item) => item.value && item.label)
                );
            },
            (e) => {
                if (!cancelled) {
                    setSchoolItems([]);
                    setSchoolsError(e?.message || "No se pudieron cargar las sedes");
                }
            }
        );
        return () => {
            cancelled = true;
        };
    }, [visible]);

    // Autogenerar el código del docente según su sede. El campo queda
    // deshabilitado: el sistema asigna el correlativo DOC-{sede}-NNN.
    React.useEffect(() => {
        if (!visible || form.role !== "teacher") return;
        const schoolId = String(form.schoolId ?? "");
        if (!schoolId) return;
        let cancelled = false;
        listActors().then(
            (actors) => {
                if (cancelled) return;
                const school = schoolItems.find((s) => s.value === schoolId);
                const schoolShort = String(school?.description ?? "").split("-")[0] || "SED";
                const instructors = (Array.isArray(actors) ? actors : []).filter(
                    (a) => Number(a?.actorTypeId ?? a?.actor_type_id) === 2
                        && String(a?.schoolId ?? a?.school_id) === schoolId
                );
                setForm((prev) => ({ ...prev, code: nextTeacherCode(instructors, schoolShort) }));
            },
            () => {}
        );
        return () => { cancelled = true; };
    }, [visible, form.role, form.schoolId, schoolItems]);

    // Sincronizar el rol del formulario cuando cambia initialRole (solo si el modal se abre de nuevo)
    React.useEffect(() => {
        if (visible && initialRole !== null && form.role !== initialRole) {
            setForm(prev => ({ ...prev, role: initialRole }));
        }
        // Preseleccionar la sede del creador (el super admin global la elige).
        if (visible && user?.schoolId != null) {
            setForm(prev => (prev.schoolId ? prev : { ...prev, schoolId: String(user.schoolId) }));
        }
    }, [initialRole, visible, user]);

    // Fichas vigentes del curso elegido (matrícula del estudiante).
    React.useEffect(() => {
        if (!visible || form.role !== "student" || !form.course || !getCohortsForCourse) {
            setCohortItems([]);
            return;
        }
        let cancelled = false;
        getCohortsForCourse(form.course).then(
            (list) => {
                if (cancelled) return;
                const options = (Array.isArray(list) ? list : []).map((c) => ({
                    value: String(c.cohortId),
                    label: c.code || String(c.cohortId),
                    icon: "users",
                }));
                setCohortItems(options);
                if (options.length === 1) {
                    setForm((prev) => ({ ...prev, cohortId: options[0].value }));
                }
            },
            () => {
                if (!cancelled) setCohortItems([]);
            }
        );
        return () => {
            cancelled = true;
        };
    }, [visible, form.role, form.course, getCohortsForCourse]);

    const setField = (key, value) => {
        setForm((prev) => {
            const updated = { ...prev, [key]: value };
             
            // Auto-generar código estudiantil en dos casos:
            // 1. Cuando se selecciona una ficha/curso Y el rol es "student"
            // 2. Cuando se cambia el rol a "student" Y ya hay una ficha seleccionada
            // Solo completa si el campo está vacío: el código que el
            // administrador escribió a mano nunca se sobreescribe.
            const shouldGenerateCode = 
                (key === "course" && value && updated.role === "student" && !String(prev.code ?? "").trim()) ||
                (key === "role" && value === "student" && updated.course && !String(prev.code ?? "").trim());
             
            if (shouldGenerateCode) {
                const fichaCode = key === "course" ? value : updated.course;
                const generatedCode = generateStudentCode(fichaCode);
                if (generatedCode) {
                    updated.code = generatedCode;
                }
            }
             
            return updated;
        });
        if (showErrors) setError(null);
    };

    const handleClose = () => {
        setForm({ ...EMPTY_FORM, role: initialRole || "" });
        setError(null);
        setShowErrors(false);
        setSuccess(false);
        onClose();
    };

    const handleSubmit = async () => {
        setShowErrors(true);
        setError(null);

        // Validación — la función es importada estáticamente
        const validationErr = validateStudentForm(form);
        if (validationErr) {
            setError(validationErr);
            return;
        }

        // Ya no validamos biometría aquí, los campos son opcionales
        await doSave(form);
    };

    const doSave = async (formToSave) => {
        setSaving(true);
        setError(null);
        const err = await onSubmit(formToSave);
        setSaving(false);
        if (err) {
            setError(t(err));
        } else {
            setSuccess(true);
            setTimeout(() => {
                setForm(EMPTY_FORM);
                setShowErrors(false);
                setSuccess(false);
                onClose();
            }, 900);
        }
    };

    const isEmpty = (v) => showErrors && !v.trim();

    // Configuración dinámica según el rol (incluyendo modo genérico)
    const roleConfig = {
        "": {
            // Modo genérico cuando no hay rol seleccionado
            title: t("Nuevo usuario"),
            subtitle: t("Completa los datos del usuario"),
            icon: "user-plus",
            buttonLabel: t("Registrar usuario"),
            successMessage: t("Usuario registrado correctamente"),
            codeLabel: t("Código"),
            codePlaceholder: t("Ej: AED-401001 o PROF001"),
            programLabel: t("Programa/Departamento"),
            programPlaceholder: t("Ej: Ingeniería de Sistemas"),
            showProgram: true,
            showFaceRegistration: true,
            rolePlaceholder: t("¿Selecciona cuál?"),
        },
        student: {
            title: t("Nuevo estudiante"),
            subtitle: t("Completa los datos del estudiante"),
            icon: "user-plus",
            buttonLabel: t("Registrar estudiante"),
            successMessage: t("Estudiante registrado correctamente"),
            codeLabel: t("Código estudiantil"),
            codePlaceholder: t("Se genera automáticamente"),
            programLabel: t("Ficha/Curso"),
            programPlaceholder: t("Seleccionar ficha/curso"),
            showProgram: true,
            showFaceRegistration: true,
            rolePlaceholder: null,
        },
        teacher: {
            title: t("Nuevo docente"),
            subtitle: t("Completa los datos del docente"),
            icon: "book-open",
            buttonLabel: t("Registrar docente"),
            successMessage: t("Docente registrado correctamente"),
            codeLabel: t("Código docente"),
            codePlaceholder: t("Se genera automáticamente"),
            programLabel: t("Ficha/Curso asignado"),
            programPlaceholder: t("Seleccionar ficha/curso"),
            showProgram: true,
            showFaceRegistration: true,
            rolePlaceholder: null,
        },
        admin: {
            title: t("Nuevo administrador"),
            subtitle: t("Completa los datos del administrador"),
            icon: "shield",
            buttonLabel: t("Registrar administrador"),
            successMessage: t("Administrador registrado correctamente"),
            codeLabel: t("Código de administrador"),
            codePlaceholder: t("Ej: ADMIN001"),
            programLabel: t("Área"),
            programPlaceholder: t("Ej: Administración General"),
            showProgram: false,
            showFaceRegistration: false,
            rolePlaceholder: null,
        },
    };

    const config = roleConfig[form.role] || roleConfig[""];

    // �tems de estado
    const statusItems = [
        { value: "active", label: t("Activo"),   icon: "check-circle" },
        { value: "inactive", label: t("Inactivo"), icon: "x-circle"     },
    ];

    if (!visible) return null;

    return (
        <React.Fragment>
            <BaseModal
                visible={visible}
                onClose={handleClose}
                title={config.title}
                subtitle={config.subtitle}
                icon={config.icon}
                maxWidth={520}
                footer={
                    <React.Fragment>
                        <Button variant="ghost" onPress={handleClose} disabled={saving}>
                            {t("Cancelar")}
                        </Button>
                        <Button variant="primary" onPress={handleSubmit} disabled={saving || success}>
                            {saving
                                ? <ActivityIndicator size="small" color={c.brand.textOnPrimary} />
                                : success
                                    ? <React.Fragment><Feather name="check" size={14} color={c.brand.textOnPrimary} /> {t("¡Guardado!")}</React.Fragment>
                                    : config.buttonLabel}
                        </Button>
                    </React.Fragment>
                }
            >
                {/* Error global */}
                {error && (
                    <View style={{
                        backgroundColor: c.status.dangerLight,
                        borderRadius: 14,
                        padding: 12,
                        flexDirection: "row",
                        gap: 8,
                        marginBottom: 14,
                    }}>
                        <Feather name="alert-circle" size={14} color={c.status.danger} />
                        <Text style={{ fontSize: 11, color: c.status.danger, flex: 1 }}>{error}</Text>
                    </View>
                )}

                {success && (
                    <View style={{
                        backgroundColor: c.status.successLight,
                        borderRadius: 14,
                        padding: 12,
                        flexDirection: "row",
                        gap: 8,
                        marginBottom: 14,
                    }}>
                        <Feather name="check-circle" size={14} color={c.status.success} />
                        <Text style={{ fontSize: 11, color: c.status.success, flex: 1 }}>
                            {config.successMessage}
                        </Text>
                    </View>
                )}

                {/* Fila 1 — Nombre y Código */}
                <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12, marginBottom: 18 }}>
                    <View style={{ flex: 1 }}>
                        <TextInput
                            label={t("Nombre completo") + " *"}
                            value={form.name}
                            onChangeText={v => setField("name", v)}
                            placeholder={t("Ej: Ana García López")}
                            error={isEmpty(form.name)}
                            errorMessage={isEmpty(form.name) ? t("Campo requerido") : ""}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <TextInput
                            label={config.codeLabel + " *"}
                            value={form.code}
                            onChangeText={v => setField("code", v)}
                            placeholder={config.codePlaceholder}
                            disabled={form.role === "student" || form.role === "teacher"}
                            error={isEmpty(form.code)}
                            errorMessage={isEmpty(form.code) ? t("Campo requerido") : ""}
                            helperText={(form.role === "student" || form.role === "teacher") ? t("Se genera automáticamente") : ""}
                        />
                    </View>
                </View>

                {/* Correo */}
                <TextInput
                    label={t("Correo electrónico") + " *"}
                    value={form.email}
                    onChangeText={v => setField("email", v)}
                    placeholder={t("correo@universidad.edu")}
                    type="email"
                    error={isEmpty(form.email)}
                    errorMessage={isEmpty(form.email) ? t("Campo requerido") : ""}
                />

                {/* Documento y contraseña: el backend los exige para crear
                    persona y usuario en todos los roles */}
                {form.role && (
                    <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12, marginBottom: 18 }}>
                        <View style={{ flex: 1 }}>
                            <TextInput
                                label={t("Número de documento") + " *"}
                                value={form.documentNumber}
                                onChangeText={v => setField("documentNumber", v)}
                                placeholder={t("Ej: 1234567890")}
                                error={isEmpty(form.documentNumber)}
                                errorMessage={isEmpty(form.documentNumber) ? t("Campo requerido") : ""}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <PasswordInput
                                label={t("Contraseña temporal") + " *"}
                                value={form.password}
                                onChangeText={v => setField("password", v)}
                                placeholder={t("Mínimo 8 caracteres")}
                                error={showErrors && String(form.password ?? "").length < 8}
                                errorMessage={showErrors && String(form.password ?? "").length < 8 ? t("Mínimo 8 caracteres") : ""}
                                helperText={t("El usuario deberá cambiarla al ingresar")}
                            />
                        </View>
                    </View>
                )}

                {/* Datos adicionales de la persona (opcionales, PersonDto) */}
                {form.role && (
                    <View style={{ gap: 0 }}>
                        <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                            <View style={{ flex: 1, marginBottom: 2 }}>
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: c.text.secondary,
                                    marginBottom: 6,
                                }}>
                                    {t("Tipo de documento")}
                                </Text>
                                <AnimatedDropdown
                                    items={["CC", "TI", "CE", "PP"].map((d) => ({ value: d, label: d, icon: "credit-card" }))}
                                    value={form.documentType}
                                    onSelect={v => setField("documentType", v)}
                                    placeholder={t("Seleccionar tipo")}
                                    triggerHeight={48}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    label={t("Teléfono")}
                                    value={form.phone}
                                    onChangeText={v => setField("phone", v)}
                                    placeholder={t("Ej: 3001234567")}
                                />
                            </View>
                        </View>
                        <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                            <View style={{ flex: 1, marginBottom: 2 }}>
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: c.text.secondary,
                                    marginBottom: 6,
                                }}>
                                    {t("Tipo de sangre")}
                                </Text>
                                <AnimatedDropdown
                                    items={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => ({ value: b, label: b, icon: "droplet" }))}
                                    value={form.bloodType}
                                    onSelect={v => setField("bloodType", v)}
                                    placeholder={t("Seleccionar tipo")}
                                    triggerHeight={48}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    label={t("Nacimiento (AAAA-MM-DD)")}
                                    value={form.birthDate}
                                    onChangeText={v => setField("birthDate", v)}
                                    placeholder={t("Ej: 2005-03-14")}
                                    error={showErrors && !!String(form.birthDate ?? "").trim() && !/^\d{4}-\d{2}-\d{2}$/.test(String(form.birthDate).trim())}
                                    errorMessage={t("Formato AAAA-MM-DD")}
                                />
                            </View>
                        </View>
                        <TextInput
                            label={t("Dirección")}
                            value={form.address}
                            onChangeText={v => setField("address", v)}
                            placeholder={t("Ej: Calle 10 # 5-20")}
                        />
                    </View>
                )}

                {/* Sede del docente/administrador (vínculo a sede vía actor) */}
                {(form.role === "admin" || form.role === "teacher") && (
                    <View style={{ marginBottom: 2 }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: (showErrors && !form.schoolId) || schoolsError ? c.status.error : c.text.secondary,
                            marginBottom: 6,
                        }}>
                            {t("Sede") + " *"}
                        </Text>
                        <AnimatedDropdown
                            items={schoolItems}
                            value={form.schoolId}
                            onSelect={v => setField("schoolId", v)}
                            placeholder={t("Seleccionar sede")}
                            searchable={!isScopedAdmin}
                            searchPlaceholder={t("Buscar...")}
                            triggerIcon="map-pin"
                            disabled={isScopedAdmin}
                            error={showErrors && !form.schoolId}
                            triggerHeight={48}
                        />
                        {isScopedAdmin && (
                            <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 4 }}>
                                {t("Solo puedes crear usuarios en tu sede.")}
                            </Text>
                        )}
                        {schoolsError && (
                            <Text style={{ fontSize: 12, color: c.status.error, marginTop: 4 }}>
                                {schoolsError}
                            </Text>
                        )}
                    </View>
                )}

                {/* Ficha de matrícula (si el curso tiene varias vigentes) */}
                {form.role === "student" && cohortItems.length > 1 && (
                    <View style={{ marginBottom: 2 }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: showErrors && !form.cohortId ? c.status.error : c.text.secondary,
                            marginBottom: 6,
                        }}>
                            {t("Ficha") + " *"}
                        </Text>
                        <AnimatedDropdown
                            items={cohortItems}
                            value={form.cohortId}
                            onSelect={v => setField("cohortId", v)}
                            placeholder={t("Seleccionar ficha")}
                            triggerIcon="users"
                            error={showErrors && !form.cohortId}
                            triggerHeight={48}
                        />
                    </View>
                )}

                {/* Fila 2 — Programa/Departamento y Rol */}
                <View style={{ flexDirection: isSmall ? "column" : "row", gap: isSmall ? 0 : 12 }}>
                    {config.showProgram && (
                        <View style={{ flex: 1 }}>
                            {/* Dropdown con búsqueda para todos los roles excepto admin */}
                            <Text style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: showErrors && !form.course ? c.status.error : c.text.secondary,
                                marginBottom: 6,
                            }}>
                                {config.programLabel + " *"}
                            </Text>
                            <AnimatedDropdown
                                items={fichaItems}
                                value={form.course}
                                onSelect={v => setField("course", v)}
                                placeholder={t("Seleccionar ficha/curso")}
                                searchable={true}
                                searchPlaceholder={t("Buscar...")}
                                maxVisible={5}
                                triggerIcon="book-open"
                                error={showErrors && !form.course}
                                triggerHeight={48}
                            />
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: showErrors && !form.role ? c.status.error : c.text.secondary,
                            marginBottom: 6,
                        }}>
                            {t("Rol") + " *"}
                        </Text>
                        <AnimatedDropdown
                            items={ROLE_ITEMS.map(r => ({
                                value:       r.value,
                                label:       t(r.label),
                                description: t(r.description),
                                icon:        r.icon,
                            }))}
                            value={form.role}
                            onSelect={v => setField("role", v)}
                            placeholder={config.rolePlaceholder || t("Seleccionar rol")}
                            error={showErrors && !form.role}
                            triggerHeight={48}
                        />
                    </View>
                </View>

                {/* Estado */}
                <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.secondary, marginBottom: 6 }}>
                        {t("Estado")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {statusItems.map((s) => (
                            <TouchableOpacity
                                key={s.value}
                                onPress={() => setField("status", s.value)}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingVertical: 10,
                                    paddingHorizontal: 14,
                                    borderRadius: 14,
                                    borderWidth: 1.5,
                                    borderColor: form.status === s.value
                                        ? c.brand.primary
                                        : c.border.primary,
                                    backgroundColor: form.status === s.value
                                        ? c.brand.primaryLight
                                        : c.background.app,
                                }}
                            >
                                <View style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: 14,
                                    backgroundColor: form.status === s.value
                                        ? c.brand.primary
                                        : c.interactive.disabled,
                                }} />
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: form.status === s.value
                                        ? c.brand.primary
                                        : c.text.secondary,
                                }}>
                                    {s.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Registro biométrico (solo para estudiantes y docentes) */}
                {config.showFaceRegistration && (
                    <View style={{
                        padding: 14,
                        borderWidth: 1.5,
                        borderColor: c.border.primary,
                        borderRadius: 14,
                        marginBottom: 14,
                        backgroundColor: c.background.app,
                        gap: 12,
                    }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.primary }}>
                            {t("Reconocimiento biométrico")}
                        </Text>
                        
                        {/* Checkbox Facial */}
                        <TouchableOpacity
                            onPress={() => setField("hasFacial", !form.hasFacial)}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <View style={{
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                borderWidth: 2,
                                borderColor: form.hasFacial ? c.status.success : c.border.primary,
                                backgroundColor: form.hasFacial ? c.status.success : "transparent",
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                                {form.hasFacial && (
                                    <Feather name="check" size={14} color="#fff" />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, color: c.text.primary }}>
                                    {t("Registro facial")}
                                </Text>
                                <Text style={{ fontSize: 11, color: c.text.secondary }}>
                                    {t("Reconocimiento por rostro")}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        
                        {/* Checkbox Huella */}
                        <TouchableOpacity
                            onPress={() => setField("hasFingerprint", !form.hasFingerprint)}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <View style={{
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                borderWidth: 2,
                                borderColor: form.hasFingerprint ? c.status.success : c.border.primary,
                                backgroundColor: form.hasFingerprint ? c.status.success : "transparent",
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                                {form.hasFingerprint && (
                                    <Feather name="check" size={14} color="#fff" />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, color: c.text.primary }}>
                                    {t("Registro de huella dactilar")}
                                </Text>
                                <Text style={{ fontSize: 11, color: c.text.secondary }}>
                                    {t("Reconocimiento por huella")}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={{ fontSize: 12, color: c.text.secondary, textAlign: "right" }}>
                    * {t("Campos obligatorios")}
                </Text>
            </BaseModal>

            {/* Modal facial secundario */}
            <FaceRegistrationModal
                visible={showFaceModal}
                studentName={form.name}
                studentId={form.code}
                onClose={() => setShowFaceModal(false)}
                onConfirm={(_descriptor) => {
                    setShowFaceModal(false);
                    const formWithFace = { ...form, hasFacial: true };
                    pendingFormRef.current = formWithFace;
                    setForm(formWithFace);
                    doSave(formWithFace);
                }}
            />
        </React.Fragment>
    );
}

