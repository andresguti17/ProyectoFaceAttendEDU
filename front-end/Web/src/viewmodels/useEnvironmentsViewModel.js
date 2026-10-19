import { useState, useMemo, useCallback, useEffect } from "react";
import { useAppData } from "../context/AppDataContext";
import { getInstitutionConfig } from "../core/config/institutionConfig";
import {
    backendEnvId,
    createEnvironment,
    deleteEnvironment,
    updateEnvironment,
} from "../services/api/environmentManagement";
import {
    backendScheduleId,
    cohortsForCourse,
    createBlocks,
    createdBlockId,
    dayLabelToIso,
    deleteBlock,
    instructorActorForUser,
    isoToDayLabel,
    replaceBlock,
} from "../services/api/scheduleBlockManagement";

// ── Formulario de ambiente ────────────────────────────────

export const EMPTY_ENV_FORM = {
    number: "",
    description: "",
    capacity: "",
    schoolId: "",
};

// ── Formulario de horario ─────────────────────────────────

export const EMPTY_SCHEDULE_FORM = {
    courseCode: "",
    courseName: "",
    cohortId: "",
    instructorQuery: "",
    instructorId: "",
    instructorName: "",
    startTime: "", // Vacío por defecto - se llenará dinámicamente
    endTime: "",   // Vacío por defecto - se llenará dinámicamente
    days: [],
};

export const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ── Validación ────────────────────────────────────────────

export function validateEnvironmentForm(form) {
    // Solo el número del ambiente es requerido
    if (!form.number.trim()) return "El número del ambiente es requerido";
    return null;
}

// ID numérico del backend o null si el curso es un alta local.
function backendCourseId(id) {
    if (id == null || String(id).trim() === "") return null;
    if (String(id).startsWith("course_")) return null;
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function numericOrNull(value) {
    if (value == null || String(value).trim() === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Convierte tiempo en formato 12h (AM/PM) a formato 24h
 * @param {string} time12h - Tiempo en formato "HH:MM AM/PM"
 * @returns {string} - Tiempo en formato "HH:MM" (24h)
 */
function convertTo24Hour(time12h) {
    // Si ya está en formato 24h, retornar tal cual
    if (!time12h.includes('AM') && !time12h.includes('PM')) {
        return time12h;
    }
    
    const timeUpper = time12h.toUpperCase().trim();
    const isPM = timeUpper.includes('PM');
    const isAM = timeUpper.includes('AM');
    
    // Extraer HH:MM
    const timePart = timeUpper.replace(/\s*(AM|PM)\s*$/i, '').trim();
    const [hoursStr, minutesStr] = timePart.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr || '00';
    
    // Conversión AM/PM a 24h
    if (isAM) {
        if (hours === 12) {
            hours = 0; // 12 AM = 00:00 (medianoche)
        }
    } else if (isPM) {
        if (hours !== 12) {
            hours += 12; // 1 PM = 13:00, 11 PM = 23:00
        }
        // 12 PM = 12:00 (mediodía) - no cambia
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/**
 * Valida solapamiento de horarios y capacidad
 * @param {Object} form - Formulario del horario
 * @param {Array} existingSchedules - Horarios existentes en el ambiente
 * @param {number} environmentCapacity - Capacidad del ambiente
 * @param {Object} selectedCourse - Curso seleccionado
 * @param {string} editingScheduleId - ID del horario en edición (null si es nuevo)
 * @returns {string|null} - Mensaje de error o null si es válido
 */
export function validateScheduleForm(form, existingSchedules = [], environmentCapacity = 0, selectedCourse = null, editingScheduleId = null) {
    // Validaciones básicas
    if (!form.courseCode.trim()) return "Completa todos los campos";
    if (!form.courseName.trim()) return "Completa todos los campos";
    if (!form.instructorId.trim()) return "Selecciona un instructor";
    if (form.days.length === 0) return "Selecciona al menos un día";
    if (!form.startTime || !form.endTime) return "Completa el horario";
    
    // Validar formato de hora (acepta 24h y 12h con AM/PM)
    const time24Regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const time12Regex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i;
    
    const isValidStart = time24Regex.test(form.startTime) || time12Regex.test(form.startTime);
    const isValidEnd = time24Regex.test(form.endTime) || time12Regex.test(form.endTime);
    
    if (!isValidStart || !isValidEnd) {
        const config = getInstitutionConfig();
        const exampleFormat = config.timeFormat24h ? "14:30" : "02:30 PM";
        return `Formato de hora inválido. Ejemplo: ${exampleFormat}`;
    }
    
    // Convertir ambas horas a formato 24h para comparación
    const startTime24 = convertTo24Hour(form.startTime);
    const endTime24 = convertTo24Hour(form.endTime);
    
    // Convertir horas a minutos para comparación
    const parseTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };
    
    const newStart = parseTime(startTime24);
    const newEnd = parseTime(endTime24);
    
    // Validar que hora fin > hora inicio
    if (newEnd <= newStart) {
        return "La hora de fin debe ser mayor a la hora de inicio";
    }
    
    // Validar capacidad del ambiente vs estudiantes del curso
    if (selectedCourse && selectedCourse.students && environmentCapacity > 0) {
        if (selectedCourse.students > environmentCapacity) {
            return `Este curso excede la capacidad maxima del ambiente de ${environmentCapacity} personas porque tiene ${selectedCourse.students} estudiantes`;
        }
    }
    
    // Validar solapamiento de horarios
    for (const schedule of existingSchedules) {
        // Si estamos editando, no comparar con el mismo horario
        if (editingScheduleId && schedule.id === editingScheduleId) continue;
        
        // Verificar si hay días en común
        const hasCommonDays = form.days.some(day => schedule.days.includes(day));
        if (!hasCommonDays) continue;
        
        // Convertir horario existente a 24h también
        const scheduleStart24 = convertTo24Hour(schedule.startTime);
        const scheduleEnd24 = convertTo24Hour(schedule.endTime);
        
        const existingStart = parseTime(scheduleStart24);
        const existingEnd = parseTime(scheduleEnd24);
        
        // Verificar solapamiento de horarios
        const overlaps = (
            (newStart >= existingStart && newStart < existingEnd) || // Empieza durante horario existente
            (newEnd > existingStart && newEnd <= existingEnd) ||     // Termina durante horario existente
            (newStart <= existingStart && newEnd >= existingEnd)     // Cubre completamente horario existente
        );
        
        if (overlaps) {
            const daysText = form.days.filter(day => schedule.days.includes(day)).join(", ");
            return `Conflicto de horarios: El curso "${schedule.courseName}" ya ocupa este ambiente los días ${daysText} de ${schedule.startTime} a ${schedule.endTime}`;
        }
    }
    
    return null;
}

/**
 * Genera placeholders dinámicos para hora inicio/fin basados en disponibilidad
 * @param {string} shift - Jornada del curso: "mañana" | "tarde" | "noche" (solo para sugerencias)
 * @param {Array} existingSchedules - Horarios existentes para calcular disponibilidad
 * @param {Array} selectedDays - Días seleccionados
 * @param {boolean} is24Hour - Si usa formato 24h (true) o 12h AM/PM (false)
 * @returns {Object} - { startPlaceholder, endPlaceholder, suggestedStart, suggestedEnd }
 */
export function getTimePlaceholders(shift, existingSchedules = [], selectedDays = [], is24Hour = false) {
    // Rango global permitido: 06:00 - 24:00
    const GLOBAL_START = "06:00";
    const GLOBAL_END = "24:00";
    
    // Rangos sugeridos por jornada (solo para sugerencias iniciales)
    const shiftRanges = {
        "mañana": { defaultStart: "06:00", defaultEnd: "12:00" },
        "tarde": { defaultStart: "12:00", defaultEnd: "18:00" },
        "noche": { defaultStart: "18:00", defaultEnd: "22:00" },
    };
    
    const range = shiftRanges[shift] || shiftRanges["mañana"];
    
    const parseTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };
    
    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (is24Hour) {
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        } else {
            const hours12 = hours % 12 || 12;
            const ampm = hours >= 12 ? 'PM' : 'AM';
            return `${hours12}:${String(mins).padStart(2, '0')} ${ampm}`;
        }
    };
    
    // Si no hay días seleccionados, retornar placeholders por defecto de la jornada
    if (selectedDays.length === 0) {
        const startMinutes = parseTime(range.defaultStart);
        const endMinutes = parseTime(range.defaultEnd);
        return {
            startPlaceholder: formatTime(startMinutes),
            endPlaceholder: formatTime(endMinutes),
            suggestedStart: formatTime(startMinutes),
            suggestedEnd: formatTime(endMinutes),
        };
    }
    
    // Filtrar horarios que comparten días con los seleccionados
    const relevantSchedules = existingSchedules.filter(schedule =>
        schedule.days.some(day => selectedDays.includes(day))
    );
    
    // Si no hay conflictos, usar horario por defecto de la jornada
    if (relevantSchedules.length === 0) {
        const startMinutes = parseTime(range.defaultStart);
        const endMinutes = parseTime(range.defaultEnd);
        return {
            startPlaceholder: formatTime(startMinutes),
            endPlaceholder: formatTime(endMinutes),
            suggestedStart: formatTime(startMinutes),
            suggestedEnd: formatTime(endMinutes),
        };
    }
    
    // Ordenar horarios existentes por hora de inicio
    const sortedSchedules = relevantSchedules
        .map(s => ({
            start: parseTime(s.startTime),
            end: parseTime(s.endTime),
        }))
        .sort((a, b) => a.start - b.start);
    
    const globalStart = parseTime(GLOBAL_START);
    const globalEnd = parseTime(GLOBAL_END);
    const defaultDuration = 120; // 2 horas por defecto
    
    // Buscar primer slot libre de al menos 2 horas dentro del rango global
    let suggestedStart = globalStart;
    
    for (const schedule of sortedSchedules) {
        // Si hay espacio antes de este horario
        if (suggestedStart + defaultDuration <= schedule.start) {
            break; // Encontramos un slot
        }
        // Mover después de este horario
        suggestedStart = Math.max(suggestedStart, schedule.end);
    }
    
    // Validar que el slot sugerido esté dentro del rango global
    if (suggestedStart + defaultDuration > globalEnd) {
        // No hay espacio suficiente, sugerir el horario por defecto de la jornada
        // La validación capturará el conflicto cuando intente guardar
        return {
            startPlaceholder: range.defaultStart,
            endPlaceholder: range.defaultEnd,
            suggestedStart: range.defaultStart,
            suggestedEnd: range.defaultEnd,
        };
    }
    
    return {
        startPlaceholder: formatTime(suggestedStart),
        endPlaceholder: formatTime(suggestedStart + defaultDuration),
        suggestedStart: formatTime(suggestedStart),
        suggestedEnd: formatTime(suggestedStart + defaultDuration),
    };
}

// ── ViewModel ─────────────────────────────────────────────

export function useEnvironmentsViewModel() {
    const appData = useAppData();

    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);
    const [envModalMode, setEnvModalMode] = useState("none");
    const [scheduleModalMode, setScheduleModalMode] = useState("none");
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [scheduleTargetEnvId, setScheduleTargetEnvId] = useState(null);

    // Escuchar eventos de avance de período para refrescar los ambientes
    useEffect(() => {
        const handlePeriodAdvanced = () => {
            console.log("[EnvironmentsViewModel] Período avanzado detectado, recargando ambientes...");
            // El AppData se recargará automáticamente al cambiar el localStorage
            // Forzar limpieza de selección actual
            setSelected(null);
        };
        
        window.addEventListener("periodAdvanced", handlePeriodAdvanced);
        
        return () => {
            window.removeEventListener("periodAdvanced", handlePeriodAdvanced);
        };
    }, []);

    // Instructores: usuarios activos con rol teacher (solo profesores, NO admins)
    const instructors = useMemo(
        () => appData.users.filter((u) => u.role === "teacher" && u.status === "active"),
        [appData.users]
    );

    const filtered = useMemo(
        () =>
            appData.environments.filter((env) => {
                if (!search) return true;
                const q = search.toLowerCase();
                return (
                    env.number.toLowerCase().includes(q) ||
                    env.description.toLowerCase().includes(q) ||
                    env.schedules.some(
                        (s) =>
                            s.courseCode.toLowerCase().includes(q) ||
                            s.courseName.toLowerCase().includes(q) ||
                            s.instructorName.toLowerCase().includes(q)
                    )
                );
            }),
        [appData.environments, search]
    );

    const searchInstructors = useCallback(
        (query) => {
            if (!query.trim()) return instructors.slice(0, 8);
            const q = query.toLowerCase();
            return instructors
                .filter(
                    (u) =>
                        u.name.toLowerCase().includes(q) ||
                        (u.code?.toLowerCase().includes(q) ?? false) ||
                        (u.department?.toLowerCase().includes(q) ?? false)
                )
                .slice(0, 10);
        },
        [instructors]
    );

    // ── Acciones de ambiente ──────────────────────────────

    const registerEnvironment = useCallback(
        async (form) => {
            const err = validateEnvironmentForm(form);
            if (err) return err;
            // La sede es obligatoria al registrar (el backend exige school_id).
            if (!String(form.schoolId ?? "").trim()) return "Selecciona la sede";

            // Aplicar valores por defecto si están vacíos
            const description = form.description.trim() || "Sin descripción";
            const capacity = form.capacity ? parseInt(form.capacity, 10) : 30;

            // Alta real en el backend; el espejo usa el ID devuelto para
            // que ediciones y borrados posteriores también lleguen al backend.
            let mirror;
            try {
                mirror = await createEnvironment({
                    schoolId: String(form.schoolId).trim(),
                    code: form.number.trim(),
                    name: description,
                    capacity,
                });
            } catch (e) {
                return e?.message || "No se pudo registrar el ambiente en el backend";
            }

            await appData.addEnvironment(mirror);
            return null;
        },
        [appData]
    );

    const editEnvironment = useCallback(
        async (id, form) => {
            const err = validateEnvironmentForm(form);
            if (err) return err;

            // Aplicar valores por defecto si están vacíos
            const description = form.description.trim() || "Sin descripción";
            const capacity = form.capacity ? parseInt(form.capacity, 10) : 30;

            const patch = {
                number: form.number.trim(),
                description,
                capacity,
            };

            // Solo los ambientes del backend se actualizan en la API;
            // las altas locales previas siguen viviendo en AsyncStorage.
            if (backendEnvId(id) != null) {
                try {
                    await updateEnvironment(id, {
                        code: form.number.trim(),
                        name: description,
                        capacity,
                    });
                } catch (e) {
                    return e?.message || "No se pudo actualizar el ambiente en el backend";
                }
            }

            await appData.updateEnvironment(id, patch);
            // Actualiza el selected sincronizando con el nuevo estado global
            const updatedEnv = appData.environments.find((e) => e.id === id);
            if (updatedEnv)
                setSelected({ ...updatedEnv, number: form.number.trim(), description });
            return null;
        },
        [appData]
    );

    const removeEnvironment = useCallback(
        async (id) => {
            if (backendEnvId(id) != null) {
                try {
                    await deleteEnvironment(id);
                } catch (e) {
                    return e?.message || "No se pudo eliminar el ambiente en el backend";
                }
            }
            await appData.removeEnvironment(id);
            setSelected(null);
            setEnvModalMode("none");
            return null;
        },
        [appData]
    );

    // ── Acciones de horario ───────────────────────────────

    // Fichas vigentes del programa de un curso (selector del modal).
    const cohortsForCourseOption = useCallback(
        (courseCode) => cohortsForCourse(courseCode),
        []
    );

    const saveSchedule = useCallback(
        async (form) => {
            if (!scheduleTargetEnvId) return "Error interno";

            // Obtener ambiente y curso seleccionado
            const environment = appData.environments.find(e => e.id === scheduleTargetEnvId);
            if (!environment) return "Ambiente no encontrado";

            const selectedCourse = appData.courses.find(c => c.code === form.courseCode);

            // Validación completa con solapamiento y capacidad
            const err = validateScheduleForm(
                form,
                environment.schedules,
                environment.capacity,
                selectedCourse,
                editingSchedule?.id || null
            );
            if (err) return err;

            // Convertir horarios a formato 24h
            const startTime = convertTo24Hour(form.startTime);
            const endTime = convertTo24Hour(form.endTime);
            const draft = {
                courseCode: form.courseCode.trim(),
                courseName: form.courseName.trim(),
                instructor: form.instructorId,
                instructorName: form.instructorName,
                startTime,
                endTime,
                days: form.days,
            };

            const envBackendId = backendEnvId(scheduleTargetEnvId);
            const courseBackendId = backendCourseId(selectedCourse?.id);
            // Filas locales (altas sin sincronizar): siguen en AsyncStorage.
            if (envBackendId == null || courseBackendId == null) {
                if (scheduleModalMode === "add") {
                    await appData.addSchedule(scheduleTargetEnvId, draft);
                } else if (editingSchedule) {
                    await appData.updateSchedule(scheduleTargetEnvId, editingSchedule.id, draft);
                } else {
                    return "Error interno";
                }
                const updatedEnv = appData.environments.find((e) => e.id === scheduleTargetEnvId);
                if (updatedEnv) setSelected(updatedEnv);
                return null;
            }

            // Filas del backend: bloques reales en ms-scheduling.
            try {
                const cohorts = await cohortsForCourse(form.courseCode);
                if (cohorts.length === 0) {
                    return "El curso no tiene fichas activas en el backend";
                }
                let cohortId = numericOrNull(form.cohortId);
                if (cohorts.length === 1) cohortId = cohorts[0].cohortId;
                if (cohortId == null) return "Selecciona la ficha del horario";

                const instructorActorId = await instructorActorForUser(
                    appData.users,
                    form.instructorId
                );
                if (instructorActorId == null) {
                    return "El instructor no tiene actor docente en la sede";
                }

                const daysOfWeek = form.days.map(dayLabelToIso);
                if (daysOfWeek.some((d) => d == null)) return "Día inválido";

                const payload = {
                    environmentId: envBackendId,
                    courseId: courseBackendId,
                    cohortId,
                    instructorActorId,
                    daysOfWeek,
                    startsAt: startTime,
                    endsAt: endTime,
                };

                if (scheduleModalMode === "add" || !editingSchedule) {
                    const created = await createBlocks(payload);
                    for (const block of created) {
                        await appData.addSchedule(scheduleTargetEnvId, {
                            ...draft,
                            id: createdBlockId(block),
                            days: [isoToDayLabel(block?.dayOfWeek ?? block?.day_of_week) ?? draft.days[0]],
                        });
                    }
                } else if (backendScheduleId(editingSchedule.id) != null) {
                    // Reemplazo: los nuevos primero, el anterior después.
                    const created = await replaceBlock(editingSchedule.id, payload);
                    await appData.removeSchedule(scheduleTargetEnvId, editingSchedule.id);
                    for (const block of created) {
                        await appData.addSchedule(scheduleTargetEnvId, {
                            ...draft,
                            id: createdBlockId(block),
                            days: [isoToDayLabel(block?.dayOfWeek ?? block?.day_of_week) ?? draft.days[0]],
                        });
                    }
                } else {
                    await appData.updateSchedule(scheduleTargetEnvId, editingSchedule.id, draft);
                }
            } catch (e) {
                return e?.message || "No se pudo guardar el horario en el backend";
            }

            // Sincroniza el selected con el nuevo estado global
            const updatedEnv = appData.environments.find((e) => e.id === scheduleTargetEnvId);
            if (updatedEnv) setSelected(updatedEnv);
            return null;
        },
        [appData, scheduleTargetEnvId, scheduleModalMode, editingSchedule]
    );

    const removeSchedule = useCallback(
        async (envId, scheduleId) => {
            if (backendScheduleId(scheduleId) != null) {
                try {
                    await deleteBlock(scheduleId);
                } catch (e) {
                    return e?.message || "No se pudo eliminar el horario en el backend";
                }
            }
            await appData.removeSchedule(envId, scheduleId);
            const updatedEnv = appData.environments.find((e) => e.id === envId);
            if (updatedEnv) setSelected(updatedEnv);
            return null;
        },
        [appData]
    );

    return {
        environments: appData.environments || [],
        filtered: filtered || [],
        users: appData.users || [],
        instructors: instructors || [],
        isLoading: appData.isLoading,
        search,
        setSearch,
        selected,
        selectEnvironment: (e) => {
            setSelected(e);
            setEnvModalMode("detail");
        },
        clearSelection: () => {
            setSelected(null);
            setEnvModalMode("none");
        },

        envModalMode,
        openRegisterModal: () => {
            setSelected(null);
            setEnvModalMode("register");
        },
        openEditModal: (e) => {
            setSelected(e);
            setEnvModalMode("edit");
        },
        openDetailModal: (e) => {
            setSelected(e);
            setEnvModalMode("detail");
        },
        closeEnvModal: () => setEnvModalMode("none"),

        scheduleModalMode,
        editingSchedule,
        scheduleTargetEnvId,
        openAddSchedule: (envId) => {
            setScheduleTargetEnvId(envId);
            setEditingSchedule(null);
            setScheduleModalMode("add");
        },
        openEditSchedule: (envId, schedule) => {
            setScheduleTargetEnvId(envId);
            setEditingSchedule(schedule);
            setScheduleModalMode("edit");
        },
        closeScheduleModal: () => {
            setScheduleModalMode("none");
            setEditingSchedule(null);
            setScheduleTargetEnvId(null);
        },

        registerEnvironment,
        editEnvironment,
        removeEnvironment,
        saveSchedule,
        removeSchedule,
        searchInstructors,
        
        // Exponer datos para el modal
        getCurrentEnvironment: () => appData.environments.find(e => e.id === scheduleTargetEnvId),
        getCourseByCode: (code) => appData.courses.find(c => c.code === code),
        cohortsForCourse: cohortsForCourseOption,
    };
}
