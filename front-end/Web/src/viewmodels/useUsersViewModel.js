// ============================================================
//  FaceAttend EDU — Users ViewModel
// ============================================================
//  RESPONSABILIDAD: Lógica de negocio para gestión de usuarios
//
//  Este ViewModel:
//  ✓ Centraliza la lógica de filtrado de todos los tipos de usuarios
//  ✓ Gestiona el estado de búsqueda y filtros
//  ✓ Proporciona funciones para registro e importación de usuarios
//  ✓ Maneja la selección de usuarios para detalle
//
//  Tipos de usuarios soportados:
//  - Estudiantes (students/aprendices)
//  - Profesores (teachers/instructores)
//  - Administradores (admins)
// ============================================================

import React, { useState, useMemo, useCallback } from "react";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { authApi } from "../services/api/authApi";
import { authorizationApi } from "../services/api/authorizationApi";
import { provisionStaff, provisionStudent, credentialsNotice, cohortsForCourseCode, importStudents as bulkImportStudents, personDetails, findExistingStudents } from "../services/api/staffProvisioning";
import { userByPersonMap } from "../services/api/referenceData";
import { isValidEmail } from "../core/utils/validation";

// Usuarios pintados por página (la vista de Usuarios pagina en el cliente
// para no cargar miles de filas de golpe en el DOM).
export const USERS_PAGE_SIZE = 25;

// ── Tipos de usuario ───────────────────────────────────────

export const USER_TYPES = {
    STUDENT: "student",
    TEACHER: "teacher",
    ADMIN: "admin",
    ALL: "all",
};

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        String(value ?? "")
    );
}

export const USER_TYPE_LABELS = {
    [USER_TYPES.STUDENT]: "Estudiante",
    [USER_TYPES.TEACHER]: "Profesor",
    [USER_TYPES.ADMIN]: "Administrador",
    [USER_TYPES.ALL]: "Todos",
};

// ── Formulario vacío ───────────────────────────────────────

export const EMPTY_USER_FORM = {
    name: "",
    code: "",
    email: "",
    course: "",
    role: USER_TYPES.STUDENT,
    documentNumber: "",
    documentType: "",
    bloodType: "",
    birthDate: "",
    address: "",
    phone: "",
    password: "",
    schoolId: "",
    cohortId: "",
    attendance: 0,
    hasFacial: false,      // Registro facial
    hasFingerprint: false, // Registro de huella dactilar
    status: "active",
};

// ── Jerarquía de roles (para ordenamiento) ─────────────────

const ROLE_HIERARCHY = {
    [USER_TYPES.STUDENT]: 1,
    [USER_TYPES.TEACHER]: 2,
    [USER_TYPES.ADMIN]: 3,
};

// ── Funciones de utilidad para filtrado avanzado ───────────

/**
 * Compara dos valores según un comparador
 * @param {number} value - Valor a comparar
 * @param {string} comparator - "gt" | "lt" | "eq"
 * @param {number} target - Valor objetivo
 * @returns {boolean}
 */
function compareValues(value, comparator, target) {
    switch (comparator) {
        case "gt": return value > target;
        case "lt": return value < target;
        case "eq": return value === target;
        default: return true;
    }
}

/**
 * Ordena un array según una columna y dirección
 * @param {Array} array - Array a ordenar
 * @param {string} column - Columna por la cual ordenar
 * @param {string} direction - "asc" | "desc"
 * @returns {Array} - Array ordenado (copia)
 */
function sortByColumn(array, column, direction) {
    const sorted = [...array];
    
    sorted.sort((a, b) => {
        let valA, valB;
        
        switch (column) {
            case "name":
                valA = a.name?.toLowerCase() || "";
                valB = b.name?.toLowerCase() || "";
                break;
            
            case "program":
                valA = a.course?.toLowerCase() || "";
                valB = b.course?.toLowerCase() || "";
                break;
            
            case "role":
                valA = ROLE_HIERARCHY[a.userType] || 0;
                valB = ROLE_HIERARCHY[b.userType] || 0;
                break;
            
            default:
                return 0;
        }
        
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
    });
    
    return sorted;
}

export function validateUserForm(form) {
    if (!form.name.trim()) return "El nombre es requerido";
    if (!form.code.trim()) return "El código es requerido";
    if (!form.email.trim()) return "El correo es requerido";
    if (!isValidEmail(form.email.trim())) return "El formato del correo electrónico no es válido";
    if (!form.role) return "El rol es requerido";

    // Todos los roles se crean en el backend (POST /persons exige
    // documentNumber, POST /users exige password de 8-100 chars).
    if (!String(form.documentNumber ?? "").trim()) return "El documento es requerido";
    if (String(form.password ?? "").length < 8) return "La contraseña debe tener al menos 8 caracteres";
    // Campos opcionales de persona (PersonDto): formato fecha si se informa.
    if (String(form.birthDate ?? "").trim() && !/^\d{4}-\d{2}-\d{2}$/.test(String(form.birthDate).trim())) {
        return "La fecha de nacimiento debe tener formato AAAA-MM-DD";
    }

    // Validación adicional para estudiantes
    if (form.role === USER_TYPES.STUDENT && !form.course?.trim()) {
        return "El programa es requerido para estudiantes";
    }

    // El docente/administrador queda vinculado a su sede (actor).
    if (
        (form.role === USER_TYPES.TEACHER || form.role === USER_TYPES.ADMIN) &&
        !String(form.schoolId ?? "").trim()
    ) {
        return "Selecciona la sede";
    }

    return null;
}

// ── ViewModel ─────────────────────────────────────────────

export function useUsersViewModel(
    section = "all", 
    initialAttendanceFilter = null, 
    initialSearchQuery = null,
    initialSortBy = null,
    initialSortOrder = null,
    initialFilterColumn = null
) {
    const appData = useAppData();
    const { user } = useAuth();
    const { t } = useTranslation();

    const [search, setSearch] = useState(initialSearchQuery || "");
    const [userTypeFilter, setUserTypeFilter] = useState(USER_TYPES.ALL);
    const [courseFilter, setCourseFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [selected, setSelected] = useState(null);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    
    // Estado de ordenamiento (inicializado desde parámetros de navegación)
    const [sortBy, setSortBy] = useState(initialSortBy || null);
    const [sortOrder, setSortOrder] = useState(initialSortOrder || "asc");

    // ── Estado de filtrado avanzado ────────────────────────────
    // Inicializar desde parámetros de navegación si existen
    const [advancedFilter, setAdvancedFilter] = useState({
        column: initialFilterColumn || (initialAttendanceFilter ? "attendance" : null),
        value: initialFilterColumn && initialSortOrder ? initialSortOrder : null,
        attendanceFilter: {
            mode: "preset",
            comparator: initialAttendanceFilter || "eq", // "gt" | "lt" | "eq"
            percentage: null, // Sin valor específico cuando viene del dashboard
        },
    });
    
    // ── Mapeo de section (sidebar) a userType ──────────────────
    const sectionToUserType = useMemo(() => ({
        students: USER_TYPES.STUDENT,
        teachers: USER_TYPES.TEACHER,
        admins: USER_TYPES.ADMIN,
    }), []);
    
    // Filtro de rol desde el sidebar (prioritario sobre dropdown)
    const roleFilterFromSection = useMemo(() => {
        return section && section !== "all" && sectionToUserType[section] 
            ? sectionToUserType[section] 
            : null;
    }, [section, sectionToUserType]);

    // ── Datos unificados de todos los usuarios ────────────────
    
    // Combinar estudiantes con otros tipos de usuarios del contexto
    const allUsers = useMemo(() => {
        const students = (appData.students || []).map(s => ({
            ...s,
            userType: USER_TYPES.STUDENT,
            typeLabelKey: "Estudiante",
        }));
        
        const teachers = (appData.teachers || []).map(t => ({
            ...t,
            userType: USER_TYPES.TEACHER,
            typeLabelKey: "Profesor",
        }));
        
        const admins = (appData.admins || []).map(a => ({
            ...a,
            userType: USER_TYPES.ADMIN,
            typeLabelKey: "Administrador",
        }));
        
        return [...students, ...teachers, ...admins];
    }, [appData.students, appData.teachers, appData.admins]);

    // ── Alcance por rol: "mis estudiantes" (teacher) / "mis compañeros" (student) ──
    // Teacher: estudiantes matriculados en fichas donde es instructor.
    // Student: compañeros matriculados en su misma ficha (excluyéndose a sí mismo).
    // RN de dominio: schedule_block.instructor_actor_id / enrollment.cohort_id
    // (ver 02-domain/entities-and-rules.md, HU-ACAD-003/004).

    const myCourseIds = useMemo(() => {
        if (!user || user.role !== "teacher") return null;
        return (appData.courses || [])
            .filter((c) => Array.isArray(c.instructorActorIds) && c.instructorActorIds.includes(user.academicActorId))
            .map((c) => c.id);
    }, [appData.courses, user]);

    const myStudentRecord = useMemo(() => {
        if (!user || user.role !== "student") return null;
        return (appData.students || []).find((s) => s.personId === user.personId) || null;
    }, [appData.students, user]);

    const scopedUsers = useMemo(() => {
        if (!user || user.role === "admin") return allUsers;

        if (user.role === "teacher") {
            if (!myCourseIds) return [];
            // Una ficha cursa varios cursos a la vez (un bloque por curso, cada
            // uno con su propio instructor): hay que mirar TODOS los cursos del
            // estudiante (courseIds), no solo el primero que trae su registro.
            return allUsers.filter(
                (u) =>
                    u.userType === USER_TYPES.STUDENT &&
                    Array.isArray(u.courseIds) &&
                    u.courseIds.some((id) => myCourseIds.includes(id))
            );
        }

        if (user.role === "student") {
            if (!myStudentRecord) return [];
            // "Compañeros" = misma ficha (cohortId), no el mismo curso puntual:
            // dos compañeros de ficha pueden tener cursos distintos entre sí
            // en algún bloque, pero siguen siendo compañeros de ficha.
            return allUsers.filter(
                (u) =>
                    u.userType === USER_TYPES.STUDENT &&
                    u.cohortId != null &&
                    u.cohortId === myStudentRecord.cohortId &&
                    u.id !== myStudentRecord.id
            );
        }

        return allUsers;
    }, [allUsers, user, myCourseIds, myStudentRecord]);

    // ── Cursos reales para el filtro de Curso ──────────────────
    // El docente solo ve los cursos donde es instructor (myCourseIds);
    // el admin, todos los de la sede activa. Se compara por id: el
    // código y el nombre se repiten entre sedes.
    const courseOptions = useMemo(() => {
        const source = (appData.courses || []).filter(
            (course) => !myCourseIds || myCourseIds.includes(course.id)
        );
        return [
            { value: "", label: t("Todos los cursos"), icon: "filter" },
            ...source.map((course) => ({
                value: String(course.id),
                label: course.name,
                icon: "book-open",
            })),
        ];
    }, [appData.courses, myCourseIds, t]);

    // ── Cursos para el "Curso destino" de la importación CSV ────
    // El valor es el courseCode (provisionStudent resuelve la cohorte por
    // código); mismo filtro de alcance que courseOptions. Las filas del
    // archivo sin columna course se matriculan en este curso.
    const importCourseOptions = useMemo(
        () =>
            (appData.courses || [])
                .filter((course) => !myCourseIds || myCourseIds.includes(course.id))
                .map((course) => ({
                    value: String(course.code ?? ""),
                    label: `${course.code} — ${course.name}`,
                    icon: "book-open",
                }))
                .filter((opt) => opt.value),
        [appData.courses, myCourseIds]
    );

    // ── Filtros de tipo de usuario ────────────────────────────
    
    const userTypeFilters = useMemo(() => [
        { value: USER_TYPES.ALL, label: t("Todos"), icon: "users" },
        { value: USER_TYPES.STUDENT, label: t("Estudiantes"), icon: "user" },
        { value: USER_TYPES.TEACHER, label: t("Profesores"), icon: "user-check" },
        { value: USER_TYPES.ADMIN, label: t("Administradores"), icon: "shield" },
    ], [t]);

    // ── Filtros de estado ──────────────────────────────────────
    
    const statusFilters = useMemo(() => [
        { value: "", label: t("Todos los estados"), icon: "filter" },
        { value: "active", label: t("Activos"), icon: "check-circle" },
        { value: "inactive", label: t("Inactivos"), icon: "x-circle" },
    ], [t]);

    // ── Usuarios filtrados ─────────────────────────────────────
    
    const filteredUsers = useMemo(
        () => {
            let result = scopedUsers.filter((user) => {
                // Filtro de búsqueda por nombre, código o email
                const matchSearch = !search ||
                    user.name.toLowerCase().includes(search.toLowerCase()) ||
                    (user.code && user.code.toLowerCase().includes(search.toLowerCase())) ||
                    (user.email && user.email.toLowerCase().includes(search.toLowerCase()));
                
                // Filtro por tipo de usuario (prioritario desde sidebar section)
                const effectiveUserTypeFilter = roleFilterFromSection || userTypeFilter;
                const matchUserType = effectiveUserTypeFilter === USER_TYPES.ALL || 
                    user.userType === effectiveUserTypeFilter;
                
                // Filtro por curso (solo aplica a estudiantes): compara por id
                // (único entre sedes) con fallback al código/nombre del mock
                const matchCourse = !courseFilter ||
                    user.userType !== USER_TYPES.STUDENT ||
                    (Array.isArray(user.courseIds) && user.courseIds.map(String).includes(courseFilter)) ||
                    user.courseId === courseFilter ||
                    user.course === courseFilter;
                
                // Filtro por estado
                const matchStatus = !statusFilter || user.status === statusFilter;
                
                // ── Filtros avanzados ──────────────────────────────
                
                // Filtro de estado desde filtro avanzado
                if (advancedFilter.column === "status" && advancedFilter.value) {
                    const matchAdvancedStatus = user.status === advancedFilter.value;
                    if (!matchAdvancedStatus) return false;
                }
                
                // Filtro de asistencia
                if (advancedFilter.column === "attendance" && 
                    advancedFilter.attendanceFilter.percentage !== null) {
                    const { comparator, percentage } = advancedFilter.attendanceFilter;
                    const matchAttendance = compareValues(
                        user.attendance || 0,
                        comparator,
                        percentage
                    );
                    if (!matchAttendance) return false;
                }
                
                return matchSearch && matchUserType && matchCourse && matchStatus;
            });
            
            // ── Ordenamiento desde filtro avanzado ─────────────────
            
            // Ordenar por nombre
            if (advancedFilter.column === "name" && advancedFilter.value) {
                result = sortByColumn(result, "name", advancedFilter.value);
            }
            
            // Ordenar por programa
            if (advancedFilter.column === "program" && advancedFilter.value) {
                result = sortByColumn(result, "program", advancedFilter.value);
            }
            
            // Ordenar por rol (jerarquía)
            if (advancedFilter.column === "role" && advancedFilter.value) {
                result = sortByColumn(result, "role", advancedFilter.value);
            }
            
            // ── Ordenamiento desde parámetros de navegación ────────
            // Se aplica solo si no hay filtro avanzado activo
            if (!advancedFilter.column && sortBy) {
                result = sortByColumn(result, sortBy, sortOrder);
            }
            
            // ── Ordenamiento automático por asistencia cuando hay filtro sin valor específico ──
            if (advancedFilter.column === "attendance" && 
                advancedFilter.attendanceFilter.percentage === null) {
                const { comparator } = advancedFilter.attendanceFilter;
                
                // Si el comparador es "gt" (mayor que) → ordenar de mayor a menor (desc)
                // Si el comparador es "lt" (menor que) → ordenar de menor a mayor (asc)
                if (comparator === "gt" || comparator === "lt") {
                    result = [...result].sort((a, b) => {
                        const attA = a.attendance || 0;
                        const attB = b.attendance || 0;
                        
                        // gt = mayor que → mostrar los más altos primero (desc)
                        // lt = menor que → mostrar los más bajos primero (asc)
                        return comparator === "gt" ? attB - attA : attA - attB;
                    });
                }
            }
            
            return result;
        },
        [scopedUsers, search, userTypeFilter, courseFilter, statusFilter, advancedFilter, roleFilterFromSection, sortBy, sortOrder]
    );

    // ── Paginación ────────────────────────────────────────────
    // El listado completo (AppData) alimenta además reportes y paneles,
    // así que no se recorta la consulta: se limita lo que se pinta por
    // pantalla en páginas de USERS_PAGE_SIZE y se pagina en el cliente.
    const [page, setPage] = useState(0);
    const totalUsers = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
    // Recorte sin useEffect: si los filtros dejan la página fuera de rango
    // se usa la última válida (regla de hooks: nada de setState en efecto).
    const safePage = Math.min(page, totalPages - 1);
    const pageUsers = filteredUsers.slice(
        safePage * USERS_PAGE_SIZE,
        safePage * USERS_PAGE_SIZE + USERS_PAGE_SIZE
    );

    // ── Estadísticas derivadas ─────────────────────────────────
    
    const stats = useMemo(() => {
        const total = allUsers.length;
        const active = allUsers.filter(u => u.status === "active").length;
        const students = allUsers.filter(u => u.userType === USER_TYPES.STUDENT).length;
        const teachers = allUsers.filter(u => u.userType === USER_TYPES.TEACHER).length;
        const admins = allUsers.filter(u => u.userType === USER_TYPES.ADMIN).length;
        
        return { total, active, students, teachers, admins };
    }, [allUsers]);

    // ── Acciones ───────────────────────────────────────────────

    const registerUser = useCallback(
        async (form) => {
            const err = validateUserForm(form);
            if (err) return err;

            // Crear objeto base del usuario
            const baseUser = {
                name: form.name.trim(),
                code: form.code.trim(),
                email: form.email.trim(),
                status: form.status,
            };

            // Delegar al método correspondiente según el tipo de usuario
            if (form.role === USER_TYPES.STUDENT) {
                let provisioned;
                try {
                    provisioned = await provisionStudent({
                        name: form.name.trim(),
                        code: form.code.trim(),
                        email: form.email.trim(),
                        documentNumber: String(form.documentNumber ?? "").trim(),
                        password: String(form.password ?? ""),
                        courseCode: form.course.trim(),
                        cohortId: String(form.cohortId ?? "").trim() || null,
                        details: form,
                        sendCredentials: form.sendCredentials !== false,
                    });
                } catch (e) {
                    return e?.message || "No se pudo registrar el estudiante en el backend";
                }

                await appData.addStudent({
                    ...baseUser,
                    course: form.course.trim(),
                    grade: form.role,
                    attendance: form.attendance || 0,
                    hasFacial: form.hasFacial || false,
                    hasFingerprint: form.hasFingerprint || false,
                });
                return credentialsNotice(form, provisioned);
            }

            // Docentes y administradores: alta real en el backend
            // (persona + usuario + rol, más academic_actor en docentes y
            // vínculo a sede con actor ADMIN en administradores).
            let staff;
            try {
                staff = await provisionStaff({
                    name: form.name.trim(),
                    code: form.code.trim(),
                    email: form.email.trim(),
                    documentNumber: String(form.documentNumber ?? "").trim(),
                    password: String(form.password ?? ""),
                    role: form.role === USER_TYPES.TEACHER ? "teacher" : "admin",
                    schoolId: String(form.schoolId ?? "").trim() || user?.schoolId,
                    details: form,
                    sendCredentials: form.sendCredentials !== false,
                });
            } catch (e) {
                return e?.message || "No se pudo registrar el usuario en el backend";
            }

            // Se trae la lista real del backend en vez de fabricar una fila
            // local: un espejo local con el "código" del formulario (que no
            // es el username real, ver provisionStaff) quedaba como fila
            // duplicada para siempre frente a la que luego trae loadUsers().
            await appData.reloadUsers();

            return credentialsNotice(form, staff);
        },
        [appData, user]
    );

    const importUsers = useCallback(
        async (drafts, userType = USER_TYPES.STUDENT) => {
            // Delegar al método correspondiente según el tipo
            if (userType === USER_TYPES.STUDENT) {
                // Alta real en el backend por fila (persona + actor + matrícula +
                // usuario + rol). Antes esto solo guardaba filas falsas en
                // AsyncStorage (appData.importStudents): "importación exitosa"
                // sin crear nada en el backend.
                const result = await bulkImportStudents(drafts);
                // Refleja en la UI lo que sí se creó de verdad (sin esto los
                // estudiantes importados no aparecían hasta recargar la página).
                // Con try/catch: si la recarga falla (p. ej. 429 del rate-limit
                // al terminar una tanda grande), el resultado de la importación
                // no se pierde detrás de un "Error al importar" genérico.
                if (result.success > 0) {
                    try { await appData.reloadStudents?.(); } catch { /* el usuario puede recargar a mano */ }
                }
                return result;
            }
            // Sin CSV con documento/contraseña no hay alta masiva de
            // docentes/administradores: error explícito, nunca éxito falso.
            throw new Error("Bulk import is only available for students");
        },
        [appData]
    );

    // OJO: las filas de estudiante traen id = academic_actor_id (numérico),
    // no el UUID de app_user: el userId real se resuelve por persona.
    const resolveUserId = useCallback(async (target) => {
        if (!target?.personId) return null;
        if (isUuid(target?.id)) return target.id;
        if (target?.userType && target.userType !== USER_TYPES.STUDENT) return target.id ?? null;
        try {
            const byPerson = await userByPersonMap();
            const linked = byPerson.get(target.personId);
            return linked?.userId ?? linked?.user_id ?? null;
        } catch {
            return null;
        }
    }, []);

    // Edición real: PUT /persons/{id} + PUT /users/{id} (+ PATCH de
    // estado si cambió). Resuelve el UUID de app_user igual que el toggle.
    const updateUserDetails = useCallback(
        async (target, form) => {
            if (!target?.personId) return "Falta el vínculo con el backend";
            const userId = await resolveUserId(target);
            if (!userId) return "Falta el vínculo con el backend";
            if (!String(form?.name ?? "").trim() || !String(form?.lastName ?? "").trim()) {
                return "El nombre y el apellido son requeridos";
            }
            if (!String(form?.documentNumber ?? "").trim()) return "El documento es requerido";
            if (!String(form?.email ?? "").trim()) return "El correo es requerido";
            if (!String(form?.username ?? "").trim()) return "El usuario es requerido";

            const nextActive = (form?.status ?? "active") === "active";
            const wasActive = (target?.status ?? "active") === "active";
            try {
                await authApi.updatePerson(target.personId, {
                    documentNumber: String(form.documentNumber).trim(),
                    name: String(form.name).trim(),
                    lastName: String(form.lastName).trim(),
                    email: String(form.email).trim().toLowerCase(),
                    phone: String(form.phone ?? "").trim() || null,
                    ...personDetails(form),
                });
                await authApi.updateUser(userId, {
                    username: String(form.username).trim(),
                });
                if (nextActive !== wasActive) {
                    await authApi.setUserStatus(userId, nextActive);
                    await authApi.setPersonStatus(target.personId, nextActive).catch(() => {});
                }
            } catch (e) {
                return e?.message || "No se pudo actualizar el usuario en el backend";
            }

            appData.patchStaff(target.userType || USER_TYPES.STUDENT, target.id, {
                name: `${String(form.name).trim()} ${String(form.lastName).trim()}`.trim(),
                email: String(form.email).trim().toLowerCase(),
                username: String(form.username).trim(),
                status: nextActive ? "active" : "inactive",
            });
            if (selected?.id === target.id) {
                setSelected((prev) =>
                    prev
                        ? {
                              ...prev,
                              name: `${String(form.name).trim()} ${String(form.lastName).trim()}`.trim(),
                              email: String(form.email).trim().toLowerCase(),
                              username: String(form.username).trim(),
                              status: nextActive ? "active" : "inactive",
                          }
                        : prev
                );
            }
            return null;
        },
        [appData, selected, resolveUserId]
    );

    // Cambio de rol (HU-IAM-010, FR 4.6, solo Super Admin en UI):
    // resuelve los role_id del backend por nombre y mueve al usuario
    // del rol anterior al nuevo vía 02-ms-authorization. Incluye
    // "superadmin" para que el rol global sea otorgable sin tocar la DB.
    const changeUserRole = useCallback(
        async (target, nextUserType) => {
            if (!target?.personId) return "Falta el vínculo con el backend";
            const userId = await resolveUserId(target);
            if (!userId) return "Falta el vínculo con el backend";
            if (![USER_TYPES.STUDENT, USER_TYPES.TEACHER, USER_TYPES.ADMIN, "superadmin"].includes(nextUserType)) {
                return "Rol no válido";
            }
            if ((target.userType || USER_TYPES.STUDENT) === nextUserType) return null;
            const candidates = {
                [USER_TYPES.STUDENT]: ["APRENDIZ", "STUDENT", "ESTUDIANTE"],
                [USER_TYPES.TEACHER]: ["INSTRUCTOR", "DOCENTE", "TEACHER"],
                [USER_TYPES.ADMIN]: ["ADMINISTRADOR", "SCHOOL_ADMIN", "ADMIN", "RECTOR", "COORDINATOR"],
                superadmin: ["SUPER_ADMINISTRADOR", "SUPER_ADMIN"],
            };
            const norm = (v) => String(v ?? "").trim().replace(/\s+/g, "_").toUpperCase();
            const pickId = (roles, names) => {
                const list = Array.isArray(roles) ? roles : roles?.data ?? [];
                for (const want of names) {
                    const found = list.find((r) => norm(r.roleName ?? r.role_name) === want);
                    if (found) return found.roleId ?? found.role_id ?? found.id;
                }
                return null;
            };
            try {
                const [allRoles, current] = await Promise.all([
                    authorizationApi.listRoles(),
                    authorizationApi.userRoles(userId),
                ]);
                const currentList = Array.isArray(current) ? current : current?.data ?? [];
                const prevNames = candidates[target.userType || USER_TYPES.STUDENT];
                const prev = currentList.find((r) => prevNames.includes(norm(r.roleName ?? r.role_name)));
                const prevId = prev ? (prev.roleId ?? prev.role_id ?? prev.id) : null;
                const nextId = pickId(allRoles, candidates[nextUserType]);
                if (nextId == null) return "El rol no existe en el backend";
                await authorizationApi.assignRole(userId, nextId);
                if (prevId != null && prevId !== nextId) {
                    await authorizationApi.removeRole(userId, prevId).catch(() => {});
                }
            } catch (e) {
                return e?.message || "No se pudo cambiar el rol en el backend";
            }
            appData.patchStaff(target.userType || USER_TYPES.STUDENT, target.id, {
                userType: nextUserType,
            });
            if (selected?.id === target.id) {
                setSelected((prev) => (prev ? { ...prev, userType: nextUserType } : prev));
            }
            await appData.reloadUsers().catch(() => {});
            return null;
        },
        [appData, selected, resolveUserId]
    );

    function selectUser(user) {
        setSelected(user);
    }

    function clearSelection() {
        setSelected(null);
    }

    // Activar/desactivar real (HU-IAM-007): PATCH /users/{id}/status +
    // PATCH /persons/{id}/status. Soft-delete universal: jamás borrado físico.
    const toggleUserStatus = useCallback(
        async (target, nextActive) => {
            const userId = await resolveUserId(target);
            if (!userId) {
                return target?.userType === USER_TYPES.STUDENT
                    ? "El estudiante no tiene usuario vinculado"
                    : "Falta el vínculo con el backend";
            }
            try {
                await authApi.setUserStatus(userId, nextActive);
                await authApi.setPersonStatus(target.personId, nextActive).catch(() => {});
            } catch (e) {
                return e?.message || "No se pudo cambiar el estado en el backend";
            }
            appData.patchStaff(target.userType || USER_TYPES.STUDENT, target.id, {
                status: nextActive ? "active" : "inactive",
            });
            if (selected?.id === target.id) {
                setSelected((prev) =>
                    prev ? { ...prev, status: nextActive ? "active" : "inactive" } : prev
                );
            }
            return null;
        },
        [appData, selected, resolveUserId]
    );

    // Eliminar lógico (HU-IAM-008): desactivar (mismo alcance que el toggle).
    // Sin DELETE físico (AGENTS.md soft-delete).
    const removeUser = useCallback(
        async (target) => {
            const err = await toggleUserStatus(target, false);
            if (err) return err;
            if (selected?.id === target?.id) setSelected(null);
            return null;
        },
        [toggleUserStatus, selected]
    );

    // Acción en lote (activate | deactivate | delete) sobre varios usuarios:
    // secuencial para no saturar el backend y para que un fallo individual
    // no aborte el resto. La cuenta propia se omite: desactivarse a uno
    // mismo dejaría la sede sin quien la administre.
    const bulkUpdateUsers = useCallback(
        async (targets, action) => {
            const failures = [];
            let done = 0;
            for (const target of targets ?? []) {
                if (user?.personId && target?.personId === user.personId) {
                    failures.push({
                        id: target?.id,
                        name: target?.name,
                        reason: "No puedes aplicar esta acción a tu propia cuenta",
                    });
                    continue;
                }
                const err =
                    action === "delete"
                        ? await removeUser(target)
                        : await toggleUserStatus(target, action === "activate");
                if (err) failures.push({ id: target?.id, name: target?.name, reason: err });
                else done += 1;
            }
            return { done, failures };
        },
        [user, removeUser, toggleUserStatus]
    );

    // ── Funciones de filtrado avanzado ─────────────────────────

    const setAdvancedFilterColumn = useCallback((column) => {
        setAdvancedFilter(prev => ({
            ...prev,
            column,
            value: null,
            attendanceFilter: {
                mode: "preset",
                comparator: "eq",
                percentage: null,
            },
        }));
    }, []);

    const setAdvancedFilterValue = useCallback((value) => {
        setAdvancedFilter(prev => ({
            ...prev,
            value,
        }));
    }, []);

    const setAttendanceFilter = useCallback((filter) => {
        setAdvancedFilter(prev => ({
            ...prev,
            attendanceFilter: filter,
        }));
    }, []);

    const clearAdvancedFilter = useCallback(() => {
        setAdvancedFilter({
            column: null,
            value: null,
            attendanceFilter: {
                mode: "preset",
                comparator: "eq",
                percentage: null,
            },
        });
    }, []);

    // ── API del ViewModel ──────────────────────────────────────

    return {
        // Datos
        allUsers,
        filteredUsers,
        // Paginación (solo lo que se pinta por página)
        pageUsers,
        page: safePage,
        totalPages,
        totalUsers,
        pageSize: USERS_PAGE_SIZE,
        setPage,
        courseOptions,
        importCourseOptions,
        userTypeFilters,
        statusFilters,
        selected,
        stats,
        
        // Estado de carga
        isLoading: appData.isLoading,
        
        // Estado de filtros básicos
        search,
        userTypeFilter,
        courseFilter,
        statusFilter,
        
        // Estado de filtros avanzados
        advancedFilter,
        
        // Estado de modales
        showRegisterModal,
        showImportModal,
        showEditModal,
        
        // Setters de filtros básicos
        setSearch,
        setUserTypeFilter,
        setCourseFilter,
        setStatusFilter,
        
        // Setters de filtros avanzados
        setAdvancedFilterColumn,
        setAdvancedFilterValue,
        setAttendanceFilter,
        clearAdvancedFilter,
        
        // Acciones de selección
        selectUser,
        clearSelection,
        
        // Acciones de modales
        openRegisterModal: () => setShowRegisterModal(true),
        closeRegisterModal: () => setShowRegisterModal(false),
        openImportModal: () => setShowImportModal(true),
        closeImportModal: () => setShowImportModal(false),
        openEditModal: () => setShowEditModal(true),
        closeEditModal: () => setShowEditModal(false),

        // Acciones de CRUD
        registerUser,
        importUsers,
        updateUserDetails,
        toggleUserStatus,
        removeUser,
        bulkUpdateUsers,
        changeUserRole,
        cohortsForCourse: cohortsForCourseCode,
        findExistingStudents,
        
        // Función para manejar actualización de usuario desde el modal de edición
        handleUserUpdated: (updatedUser) => {
            console.log('handleUserUpdated llamado con:', updatedUser);
            
            // Actualizar el usuario seleccionado con los nuevos datos
            setSelected(updatedUser);
            
            // Forzar un re-render de la lista completa
            // Esto debería provocar que el contexto se recalcule
            setTimeout(() => {
                console.log('Forzando actualización de la vista...');
            }, 100);
        },
    };
}
