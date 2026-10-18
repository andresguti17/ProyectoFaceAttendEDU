// ============================================================
//  FaceAttend EDU — Courses ViewModel
// ============================================================
//  RESPONSABILIDAD: Lógica de negocio para gestión de cursos/fichas
//
//  Este ViewModel:
//  ✓ Centraliza la lógica de filtrado de cursos
//  ✓ Gestiona el estado de búsqueda y filtros avanzados
//  ✓ Proporciona funciones para registro e importación de cursos
//  ✓ Maneja la selección de cursos para detalle
//  ✓ Calcula estadísticas derivadas de los cursos
// ============================================================

import { useState, useMemo, useCallback } from "react";
import { useAppData } from "../context/AppDataContext";
import { getAttendanceThresholds, getAtRiskStudents } from "../models/data/userDerivedData";
import { useAuth } from "../context/AuthContext";
import { createCourse, updateCourse, deleteCourse as deleteCourseApi, importCourses as bulkImportCourses } from "../services/api/courseCreation";

// ── Formulario vacío ───────────────────────────────────────

export const EMPTY_COURSE_FORM = {
    code: "",
    name: "",
    programId: "",
    creditHours: "",
    schedule: "mañana",
    startDate: "",
    endDate: "",
};

// ── Validación de formulario ──────────────────────────────

/**
 * Créditos opcionales (credit_hours SMALLINT 0..32767): null si vacío.
 */
export function parseCreditHours(value) {
    const raw = String(value ?? "").trim();
    if (raw === "") return null;
    if (!/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    return n <= 32767 ? n : null;
}

export function validateCourseForm(form) {
    if (!form.name.trim()) return "El nombre es requerido";
    // El backend exige program_id (FK NOT NULL) para crear el curso.
    if (!String(form.programId ?? "").trim()) return "El programa es requerido";
    // credit_hours es SMALLINT (0..32767, default 3 en el backend): opcional.
    const rawCredits = String(form.creditHours ?? "").trim();
    if (rawCredits !== "" && (!/^\d+$/.test(rawCredits) || Number(rawCredits) > 32767)) {
        return "Los créditos deben ser un número entre 0 y 32767";
    }

    if (!form.code.trim()) return "El código es requerido";
    
    return null;
}

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
            
            case "code":
                valA = a.code?.toLowerCase() || "";
                valB = b.code?.toLowerCase() || "";
                break;
            
            case "instructor":
                valA = a.professor?.toLowerCase() || "";
                valB = b.professor?.toLowerCase() || "";
                break;
            
            case "students":
                valA = a.students || 0;
                valB = b.students || 0;
                break;
            
            case "attendance":
                valA = a.avgAttendance || 0;
                valB = b.avgAttendance || 0;
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

// ── ViewModel ─────────────────────────────────────────────

export function useCoursesViewModel() {
    const appData = useAppData();
    const { user } = useAuth();

    const [search, setSearch] = useState("");
    const [instructorFilter, setInstructorFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [selected, setSelected] = useState(null);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);

    // ── Estado de filtrado avanzado ────────────────────────────
    
    const [advancedFilter, setAdvancedFilter] = useState({
        column: null,
        value: null,
        attendanceFilter: {
            mode: "preset",
            comparator: "eq", // "gt" | "lt" | "eq"
            percentage: null,
        },
    });

    // ── Cursos desde el contexto (fuente de verdad) ────────────
    
    const courses = useMemo(() => {
        // Si aún está cargando, retornar array vacío
        if (appData.isLoading) {
            return [];
        }
        
        // Usar directamente los cursos del contexto
        return appData.courses || [];
    }, [appData.isLoading, appData.courses]);

    // ── Instructores únicos para filtro ────────────────────────
    
    const instructors = useMemo(() => {
        const uniqueInstructors = [...new Set(courses.map(c => c.professor).filter(Boolean))];
        return uniqueInstructors.map(instructor => ({
            value: instructor,
            label: instructor,
            icon: "user"
        }));
    }, [courses]);

    // ── Filtros de estado ──────────────────────────────────────
    
    const statusFilters = useMemo(() => [
        { value: "", label: "Todos los estados", icon: "filter" },
        { value: "active", label: "Activos", icon: "check-circle" },
        { value: "inactive", label: "Inactivos", icon: "x-circle" },
        { value: "completed", label: "Finalizados", icon: "archive" },
    ], []);

    // ── Cursos filtrados ───────────────────────────────────────
    
    const filtered = useMemo(
        () => {
            let result = courses.filter((course) => {
                // Filtro de búsqueda por nombre o código
                const matchSearch = !search ||
                    course.name.toLowerCase().includes(search.toLowerCase()) ||
                    course.code.toLowerCase().includes(search.toLowerCase()) ||
                    (course.professor && course.professor.toLowerCase().includes(search.toLowerCase()));
                
                // Filtro por instructor
                const matchInstructor = !instructorFilter || 
                    course.professor === instructorFilter;
                
                // Filtro por estado
                const matchStatus = !statusFilter || course.status === statusFilter;
                
                // ── Filtros avanzados ──────────────────────────────
                
                // Filtro de estado desde filtro avanzado
                if (advancedFilter.column === "status" && advancedFilter.value) {
                    const matchAdvancedStatus = course.status === advancedFilter.value;
                    if (!matchAdvancedStatus) return false;
                }
                
                // Filtro de asistencia
                if (advancedFilter.column === "attendance" && 
                    advancedFilter.attendanceFilter.percentage !== null) {
                    const { comparator, percentage } = advancedFilter.attendanceFilter;
                    const matchAttendance = compareValues(
                        course.avgAttendance || 0,
                        comparator,
                        percentage
                    );
                    if (!matchAttendance) return false;
                }
                
                return matchSearch && matchInstructor && matchStatus;
            });
            
            // ── Ordenamiento desde filtro avanzado ─────────────────
            
            // Ordenar por nombre
            if (advancedFilter.column === "name" && advancedFilter.value) {
                result = sortByColumn(result, "name", advancedFilter.value);
            }
            
            // Ordenar por código
            if (advancedFilter.column === "code" && advancedFilter.value) {
                result = sortByColumn(result, "code", advancedFilter.value);
            }
            
            // Ordenar por instructor
            if (advancedFilter.column === "instructor" && advancedFilter.value) {
                result = sortByColumn(result, "instructor", advancedFilter.value);
            }
            
            // Ordenar por estudiantes
            if (advancedFilter.column === "students" && advancedFilter.value) {
                result = sortByColumn(result, "students", advancedFilter.value);
            }
            
            // ── Ordenamiento automático por asistencia cuando hay filtro sin valor específico ──
            if (advancedFilter.column === "attendance" && 
                advancedFilter.attendanceFilter.percentage === null) {
                const { comparator } = advancedFilter.attendanceFilter;
                
                // Si el comparador es "gt" (mayor que) → ordenar de mayor a menor (desc)
                // Si el comparador es "lt" (menor que) → ordenar de menor a mayor (asc)
                if (comparator === "gt" || comparator === "lt") {
                    result = [...result].sort((a, b) => {
                        const attA = a.avgAttendance || 0;
                        const attB = b.avgAttendance || 0;
                        
                        // gt = mayor que → mostrar los más altos primero (desc)
                        // lt = menor que → mostrar los más bajos primero (asc)
                        return comparator === "gt" ? attB - attA : attA - attB;
                    });
                }
            }
            
            return result;
        },
        [courses, search, instructorFilter, statusFilter, advancedFilter]
    );

    // ── Alcance por rol: "mis fichas" (teacher) / "mi ficha" (student) ──
    // Teacher: fichas donde es instructor de algún bloque (instructorActorIds).
    // Student: la ficha en la que está matriculado (su propio courseId).
    // RN de dominio: schedule_block.instructor_actor_id / enrollment.academic_actor_id
    // (ver 02-domain/entities-and-rules.md, HU-ACAD-003/004).

    const myCourseIds = useMemo(() => {
        if (!user) return [];
        if (user.role === "teacher") {
            return courses
                .filter((c) => Array.isArray(c.instructorActorIds) && c.instructorActorIds.includes(user.academicActorId))
                .map((c) => c.id);
        }
        if (user.role === "student") {
            const mine = (appData.students || []).find((s) => s.personId === user.personId);
            // Una ficha cursa varios cursos a la vez: courseIds trae todos los
            // que tiene asignados su cohorte, no solo el primero (courseId).
            return mine && Array.isArray(mine.courseIds) ? mine.courseIds : [];
        }
        return [];
    }, [courses, user, appData.students]);

    const myCourses = useMemo(
        () => courses.filter((c) => myCourseIds.includes(c.id)),
        [courses, myCourseIds]
    );

    const myFiltered = useMemo(() => {
        if (!search) return myCourses;
        const q = search.toLowerCase();
        return myCourses.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.code.toLowerCase().includes(q) ||
                (c.professor && c.professor.toLowerCase().includes(q))
        );
    }, [myCourses, search]);

    const myStats = useMemo(() => {
        // Estudiantes ÚNICOS en mis cursos: sumar x.students por curso
        // duplica cuando dos cursos comparten la misma ficha.
        const mine = new Set(myCourseIds.map(String));
        const seen = new Set();
        let attSum = 0;
        for (const s of appData.students || []) {
            const ids = Array.isArray(s.courseIds) ? s.courseIds.map(String) : [];
            const match = ids.length
                ? ids.some((id) => mine.has(id))
                : myCourses.some((c) => c.code === s.course || c.name === s.course);
            if (!match) continue;
            const key = s.personId ?? s.id;
            if (seen.has(key)) continue;
            seen.add(key);
            attSum += s.attendance || 0;
        }
        const totalStudents = seen.size;
        const avgAttendance =
            totalStudents === 0 ? 0 : Math.round(attSum / totalStudents);
        const alertCount = myCourses.filter((x) => (x.avgAttendance || 0) < 80).length;
        return { total: myCourses.length, totalStudents, avgAttendance, alertCount };
    }, [myCourses, myCourseIds, appData.students]);

    // ── Estadísticas derivadas ─────────────────────────────────
    
    const totalStudents = useMemo(() => {
        // Contar estudiantes REALES que están en alguno de estos cursos
        // En lugar del campo hardcodeado 'students'
        const courseCodes = new Set(courses.map(course => course.code));
        const students = appData.students || [];
        
        return students.filter(student => 
            student.status === "active" && 
            courseCodes.has(student.course)
        ).length;
    }, [courses, appData.students]);

    const avgAttendance = useMemo(() => {
        if (courses.length === 0) return 0;
        
        // Calcular asistencia promedio REAL basada en estudiantes
        const students = appData.students || [];
        const courseCodes = new Set(courses.map(course => course.code));
        
        const courseStudents = students.filter(student => 
            student.status === "active" && 
            courseCodes.has(student.course)
        );
        
        if (courseStudents.length === 0) return 0;
        
        const totalAttendance = courseStudents.reduce((sum, student) => 
            sum + (student.attendance || 0), 0
        );
        
        return Math.round(totalAttendance / courseStudents.length);
    }, [courses, appData.students]);

    const alertCount = useMemo(() => {
        // Usar la MISMA lógica que getAtRiskStudents para ser consistente
        const students = appData.students || [];
        const courseCodes = new Set(courses.map(course => course.code));
        
        const courseStudents = students.filter(student => 
            student.status === "active" && 
            courseCodes.has(student.course)
        );
        
        const thresholds = getAttendanceThresholds();
        const config = {
            minAttendance: thresholds.minAttendance,
            daysUntilSanction: 30, // Por defecto, debería venir de config
            consecutiveDaysForSanction: thresholds.consecutiveDaysForSanction
        };
        
        // Usar getAtRiskStudents con los estudiantes de estos cursos
        const atRiskStudents = getAtRiskStudents(courseStudents, config.minAttendance);
        
        return atRiskStudents.length;
    }, [courses, appData.students]);
    
    const stats = useMemo(() => {
        const total = courses.length;
        const active = courses.filter(c => c.status === "active").length;
        const completed = courses.filter(c => c.status === "completed").length;
        
        return { 
            total, 
            active, 
            completed, 
            totalStudents, 
            avgAttendance, 
            alertCount 
        };
    }, [courses, totalStudents, avgAttendance, alertCount]);

    // ── Acciones ───────────────────────────────────────────────

    const registerCourse = useCallback(
        async (form) => {
            const err = validateCourseForm(form);
            if (err) return err;

            // Alta real en el backend (programa + código únicos por sede).
            try {
                await createCourse({
                    programId: form.programId,
                    code: form.code.trim(),
                    name: form.name.trim(),
                    creditHours: parseCreditHours(form.creditHours),
                });
            } catch (e) {
                return e?.message || "No se pudo registrar el curso en el backend";
            }

            // Se trae la lista real del backend en vez de fabricar una fila
            // local: un espejo local quedaba duplicado para siempre frente
            // al curso real que luego trae loadCourses() (mismo problema que
            // reloadUsers resolvió para docentes/admins).
            await appData.reloadCourses();

            return null;
        },
        [appData]
    );

    const editCourse = useCallback(
        async (form) => {
            const err = validateCourseForm(form);
            if (err) return err;
            if (editingCourse == null) return "No hay curso seleccionado";

            try {
                await updateCourse(Number(editingCourse.id), {
                    programId: form.programId,
                    code: form.code.trim(),
                    name: form.name.trim(),
                    creditHours: parseCreditHours(form.creditHours),
                });
            } catch (e) {
                return e?.message || "No se pudo editar el curso en el backend";
            }

            // El id ya existe en `courses`: se parchea, no se agrega una fila.
            await appData.updateCourse(editingCourse.id, {
                programId: form.programId,
                code: form.code.trim(),
                name: form.name.trim(),
                ...(parseCreditHours(form.creditHours) != null
                    ? { creditHours: parseCreditHours(form.creditHours) }
                    : {}),
            });

            return null;
        },
        [appData, editingCourse]
    );

    const importCourses = useCallback(
        async (drafts) => {
            // Importación real: un curso por fila, con el programa
            // resuelto por código o nombre dentro de la sede.
            try {
                return await bulkImportCourses(user?.schoolId ?? null, drafts);
            } catch (e) {
                return {
                    success: 0,
                    errors: [{ course: "", reason: e?.message || "No se pudo importar" }],
                };
            }
        },
        [user]
    );

    // Eliminar curso (HU-SCH-001, FR 8.1, solo Super Admin en UI).
    const removeCourse = useCallback(
        async (course) => {
            if (course?.id == null) return "Falta el curso a eliminar";
            try {
                await deleteCourseApi(course.id);
            } catch (e) {
                return e?.message || "No se pudo eliminar el curso en el backend";
            }
            await appData.reloadCourses();
            if (selected?.id === course.id) setSelected(null);
            if (editingCourse?.id === course.id) setEditingCourse(null);
            return null;
        },
        [appData, selected, editingCourse]
    );

    // Activar/desactivar curso (actualizar estado).
    const toggleCourseStatus = useCallback(
        async (course) => {
            if (course?.id == null) return "Falta el curso";
            if (course.programId == null) return "El curso no tiene programa asociado";
            const nextActive = (course.status ?? "active") !== "active";
            try {
                await updateCourse(Number(course.id), {
                    programId: course.programId,
                    code: course.code,
                    name: course.name,
                    status: nextActive,
                });
            } catch (e) {
                return e?.message || "No se pudo cambiar el estado del curso";
            }
            await appData.updateCourse(course.id, { status: nextActive ? "active" : "inactive" });
            return null;
        },
        [appData]
    );

    function selectCourse(course) {
        setSelected(course);
    }

    function clearSelection() {
        setSelected(null);
    }

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
        courses: courses || [],
        filtered: filtered || [],
        myCourses,
        myFiltered,
        myStats,
        instructors,
        statusFilters,
        selected,
        stats,
        
        // Estado de carga
        isLoading: appData.isLoading,
        
        // Estado de filtros básicos
        search,
        instructorFilter,
        statusFilter,
        
        // Estado de filtros avanzados
        advancedFilter,
        
        // Estado de modales
        showRegisterModal,
        showImportModal,
        editingCourse,
        
        // Setters de filtros básicos
        setSearch,
        setInstructorFilter,
        setStatusFilter,
        
        // Setters de filtros avanzados
        setAdvancedFilterColumn,
        setAdvancedFilterValue,
        setAttendanceFilter,
        clearAdvancedFilter,
        
        // Acciones de selección
        selectCourse,
        clearSelection,
        
        // Acciones de modales
        openRegisterModal: () => setShowRegisterModal(true),
        closeRegisterModal: () => setShowRegisterModal(false),
        openImportModal: () => setShowImportModal(true),
        closeImportModal: () => setShowImportModal(false),
        openEditModal: (course) => {
            setEditingCourse(course);
            setSelected(null); // cierra el detalle para mostrar la edición
        },
        closeEditModal: () => setEditingCourse(null),

        // Acciones de CRUD
        registerCourse,
        editCourse,
        importCourses,
        removeCourse,
        toggleCourseStatus,
        
        // Estadísticas (legacy - mantener por compatibilidad)
        totalStudents,
        avgAttendance,
        alertCount,
    };
}
