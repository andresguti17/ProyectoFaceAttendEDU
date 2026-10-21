// ============================================================
//  FaceAttend EDU — AppDataContext
//
//  ÚNICA fuente de verdad para los datos de la aplicación.
//  Centraliza students, users y environments en un solo
//  contexto global, eliminando cargas duplicadas y
//  garantizando consistencia entre módulos.
//
//  Cuando haya una API real, solo este archivo cambia:
//  reemplaza los loadX() con llamadas HTTP y listo.
//
//  Uso:
//    const { students, addStudent, ... } = useAppData();
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { biometricCaptureApi } from "../services/api/biometricCaptureApi";
import { syncInstitutionConfigFromBackend } from "../services/api/settingsPersistence";
import { resetReferenceData, setActiveSchool, setUsersListAllowed } from "../services/api/referenceData";
import { useAuth } from "./AuthContext";

import {
    loadStudents,
    saveStudents,
    addStudent as storageAddStudent,
    addStudentsBulk as storageAddStudentsBulk,
} from "../models/data/StudentStorage";

import {
    loadUsers,
    addUser as storageAddUser,
    updateUser as storageUpdateUser,
    deleteUser as storageDeleteUser,
} from "../models/data/UserStorage";

import {
    loadEnvironments,
    addEnvironment as storageAddEnvironment,
    updateEnvironment as storageUpdateEnvironment,
    deleteEnvironment as storageDeleteEnvironment,
    addScheduleToEnvironment,
    updateSchedule,
    deleteSchedule,
} from "../models/data/EnvironmentStorage";

import {
    loadFichas,
    addFicha as storageAddFicha,
    updateFicha as storageUpdateFicha,
    deleteFicha as storageDeleteFicha,
} from "../models/data/FichaStorage";

import {
    loadCourses,
    addCourse as storageAddCourse,
    updateCourse as storageUpdateCourse,
    deleteCourse as storageDeleteCourse,
} from "../models/data/CourseStorage";

import { calculateStudentCurrentPeriod } from "../core/utils/studentPeriodCalculator";
import { getConfiguredAcademicPeriodType } from "../core/constants/academicPeriods";
import { getStudentPeriodFromData } from "../core/utils/studentPeriodCalculator";
import { onInstitutionConfigChange } from "../core/config/institutionConfig";

// ── Filas de personal (docentes / administradores) ─────────
// Los usuarios vienen de la API con role admin|teacher|student;
// aquí se completan los campos que la vista de personal espera y
// que el backend aún no expone (asistencia, biométricos).

function toStaffRow(user) {
    return {
        ...user,
        grade: user.role === "admin" ? "Administrador" : "Docente",
        attendance: 0, // pendiente de la fase de consulta
        hasFacial: false,
        hasFingerprint: false,
    };
}

function splitStaff(users) {
    const list = Array.isArray(users) ? users : [];
    return {
        teacherRows: list.filter((u) => u.role === "teacher").map(toStaffRow),
        adminRows: list.filter((u) => u.role === "admin").map(toStaffRow),
    };
}

// ── Revelado progresivo (efecto persiana) ─────────────────
// Tandas fijas: la animación tarda lo mismo con 20 filas que con 2.000.
const REVEAL_STEPS = 12;
const REVEAL_INTERVAL_MS = 150;

// ── Context ───────────────────────────────────────────────

const AppDataContext = createContext(null);

// ── Provider ──────────────────────────────────────────────

export function AppDataProvider({ children }) {
    const [students, setStudents] = useState([]);
    const [users, setUsers] = useState([]);
    const [environments, setEnvironments] = useState([]);
    const [fichas, setFichas] = useState([]);
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // Estados para carga progresiva de usuarios
    const [loadedStudents, setLoadedStudents] = useState([]);
    const [loadedTeachers, setLoadedTeachers] = useState([]);
    const [loadedAdmins, setLoadedAdmins] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Para forzar re-renders
    
    // Estado para el tipo de período académico (reactivo a cambios en Settings)
    const [periodType, setPeriodType] = useState(() => getConfiguredAcademicPeriodType());
    
    // Función para forzar refresh del contexto (definida antes para usarla en efectos)
    const forceRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // Temporizador del revelado: se guarda para poder cancelarlo al cerrar sesión o
    // al desmontar. Sin esto un login tras un logout dejaba dos revelados en marcha.
    const revealTimer = useRef(null);

    // Escuchar cambios en la configuración institucional
    useEffect(() => {
        const cleanup = onInstitutionConfigChange((newConfig) => {
            // Actualizar el tipo de período si cambió
            if (newConfig.academicPeriodType && newConfig.academicPeriodType !== periodType) {
                console.log('[AppDataContext] Tipo de período cambió:', newConfig.academicPeriodType);
                setPeriodType(newConfig.academicPeriodType);
                // Forzar recálculo de datos enriquecidos
                forceRefresh();
            }
        });
        
        return cleanup;
    }, [periodType, forceRefresh]);
    
    // Recalcular estudiantes cuando cambia el periodType
    useEffect(() => {
        if (loadedStudents.length > 0 && courses.length > 0) {
            // Re-enriquecer estudiantes con el nuevo tipo de período
            const enrichedStudents = loadedStudents.map(student => {
                const studentCourse = courses.find(
                    c => c.code === student.course || c.name === student.course || c.id === student.course
                );
                
                if (studentCourse) {
                    const periodInfo = calculateStudentCurrentPeriod(
                        studentCourse.startDate,
                        studentCourse.endDate,
                        periodType
                    );
                    
                    return {
                        ...student,
                        grade: periodInfo.label || '—',
                        periodInfo,
                    };
                }
                
                return student;
            });
            
            setLoadedStudents(enrichedStudents);
        }
    }, [periodType, courses]); // REMOVED: students, loadedStudents from dependencies    
    // Cursos enriquecidos con período calculado (fuente de verdad)
    const enrichedCourses = useMemo(() => {
        if (!courses || courses.length === 0) return courses;
        
        return courses.map(course => {
            // Calcular período actual del curso
            const periodInfo = calculateStudentCurrentPeriod(
                course.startDate,
                course.endDate,
                periodType
            );
            
            return {
                ...course,
                currentPeriod: periodInfo.label || '—',
                periodInfo, // Info completa del período
            };
        });
    }, [courses, periodType]);
    
    // Carga progresiva de usuarios (efecto persiana)
    const startProgressiveUserLoading = useCallback((allStudents, allCourses, allUsers) => {
        setIsLoadingUsers(true);
        setLoadedStudents([]);
        setLoadedTeachers([]);
        setLoadedAdmins([]);
        
        // Primero, enriquecer cursos con su período (fuente de verdad)
        const coursesWithPeriod = allCourses.map(course => {
            const periodInfo = calculateStudentCurrentPeriod(
                course.startDate,
                course.endDate,
                periodType
            );
            return {
                ...course,
                currentPeriod: periodInfo.label || '—',
                periodInfo,
            };
        });
        
        // Luego, estudiantes heredan el período de su curso
        const enrichedStudents = allStudents.map(student => {
            // Buscar el curso del estudiante
            // Por id: buscar por code o name devolvia el primer curso homonimo, que
            // puede ser el de la otra sede.
            const studentCourse = coursesWithPeriod.find((c) => String(c.id) === student.courseId)
                ?? coursesWithPeriod.find((c) => c.code === student.course || c.name === student.course);
            
            // Heredar el período del curso
            return {
                ...student,
                grade: studentCourse?.currentPeriod || student.grade || '—',
                periodInfo: studentCourse?.periodInfo || null,
            };
        });
        
        // Combinar todos los usuarios (el personal sale de la API, no de mocks)
        const { teacherRows, adminRows } = splitStaff(allUsers);
        const total = enrichedStudents.length + teacherRows.length + adminRows.length;

        // Revelado progresivo por tandas. Antes se revelaba UNA fila cada 150 ms con
        // `prev => [...prev, user]`: con 1.688 estudiantes eran ~4,2 min de espera y
        // una copia del arreglo completo por fila (coste cuadrático), con la vista
        // re-renderizando 1.688 veces. Ahora la animación siempre dura REVEAL_STEPS
        // tandas, así que el coste no depende del tamaño del conjunto de datos.
        clearInterval(revealTimer.current);

        let revealed = 0;
        const step = Math.max(1, Math.ceil(total / REVEAL_STEPS));
        const clamp = (value, max) => Math.min(Math.max(value, 0), max);

        const loadInterval = setInterval(() => {
            revealed = Math.min(revealed + step, total);

            // slice() sobre el origen en vez de acumular: una copia por tanda, no por fila.
            setLoadedStudents(enrichedStudents.slice(0, clamp(revealed, enrichedStudents.length)));
            setLoadedTeachers(
                teacherRows.slice(0, clamp(revealed - enrichedStudents.length, teacherRows.length))
            );
            setLoadedAdmins(
                adminRows.slice(
                    0,
                    clamp(revealed - enrichedStudents.length - teacherRows.length, adminRows.length)
                )
            );

            if (revealed >= total) {
                clearInterval(loadInterval);
                setIsLoadingUsers(false);
            }
        }, REVEAL_INTERVAL_MS);

        revealTimer.current = loadInterval;
        return () => clearInterval(loadInterval);
    }, [periodType]);

    // ── Carga de datos base (environments, fichas, courses) ────
    // Solo con sesión: sin token todas las peticiones responderían 401 y
    // caeríamos al mock de respaldo sin reintentar (el efecto no se vuelve
    // a ejecutar). Al cerrar sesión se limpia todo, incluida la caché de
    // datos de referencia, para no arrastrar datos de otra sesión.
    const { user, isLoadingAuth } = useAuth();

    useEffect(() => {
        if (isLoadingAuth) return undefined; // aún restaurando la sesión guardada

        if (!user) {
            // Sin sesión no hay nada que pedir; se olvida la caché de
            // referencia para que el próximo login vuelva a consultar.
            // El estado cargado se reemplaza entero al iniciar sesión.
            resetReferenceData();
            setLoadError(null);
            return undefined;
        }

        // La sede del usuario acota todas las cargas de abajo. Debe fijarse ANTES
        // de pedir nada: setActiveSchool limpia la caché si la sede cambió.
        setActiveSchool(user.schoolId ?? null);
        // Ajustes de la sede (asistencia mínima, reconocimiento, avisos) para todos los roles.
        // La seguridad global solo la lee quien administra (los demás recibirían un 403).
        syncInstitutionConfigFromBackend(user.schoolId ?? null, { includeSecurity: user?.role === "admin" }).catch(() => {});
        // /users exige identity.person:write (solo administración): se prohibe
        // la petición ANTES de que ningún Storage la dispare con Instructor/Aprendiz.
        setUsersListAllowed(user?.role === "admin");

        let cancelled = false;
        // loadStudents() va aparte: agrega la asistencia de CADA estudiante en
        // lotes de 200 (attendanceSummaryFor) y con miles de estudiantes puede
        // tardar bastante o saturar la cola de conexiones del navegador. Antes
        // viajaba en el mismo Promise.allSettled que usuarios/ambientes/fichas/
        // cursos, así que Admins y Profesores —que no usan `students` para nada—
        // se quedaban en "Cargando..." indefinidamente esperando esa asistencia.
        // allSettled en vez de all: si UNA carga falla (p. ej. /cohorts), las
        // demás (usuarios, ambientes, cursos...) sí se muestran; antes un solo
        // rechazo descartaba todo y el Inicio del docente quedaba vacío.
        //
        // /users exige identity.person:write: solo administración puede pedirlo.
        // Instructor y Aprendiz recibían 403 y el banner de error aparecía en
        // todas sus pantallas, así que para esos roles la carga ni se lanza.
        const canListUsers = user?.role === "admin";

        // Las filas nacen con hasFacial/hasFingerprint en false; lo registrado vive en
        // ms-biometric, así que sin esto la lista vuelve a "Pendiente" al recargar.
        // Si el rol no puede consultarlo (403) o falla, las filas quedan como están.
        const biometricFlags = biometricCaptureApi
            .summaryAll()
            .then((r) => ({
                face: new Set((r?.face_person_ids ?? []).map(String)),
                fingerprint: new Set((r?.fingerprint_person_ids ?? []).map(String)),
            }))
            .catch(() => null);
        const withBiometrics = (rows, flags) =>
            !flags
                ? rows
                : rows.map((row) =>
                      row.personId == null
                          ? row
                          : {
                                ...row,
                                hasFacial: flags.face.has(String(row.personId)),
                                hasFingerprint: flags.fingerprint.has(String(row.personId)),
                            }
                  );

        Promise.allSettled([
            canListUsers ? loadUsers() : Promise.resolve([]),
            loadEnvironments(),
            loadFichas(),
            loadCourses(),
        ]).then(async (results) => {
            const flags = await biometricFlags;
            if (cancelled) return;
            const [rawUsers, e, f, c] = results.map((r) =>
                r.status === "fulfilled" ? r.value : []
            );
            const u = withBiometrics(rawUsers, flags);
            const failed = results.filter((r) => r.status === "rejected");
            if (failed.length > 0) {
                const messages = failed.map((r) => r.reason?.message || "error desconocido");
                console.error("[FaceAttend] AppDataContext: cargas parciales fallidas —", messages.join(" | "));
                setLoadError(messages[0]);
            } else {
                setLoadError(null);
            }
            setUsers(u);
            setEnvironments(e);
            setFichas(f);
            setCourses(c);
            setIsLoading(false);

            // Carga progresiva de usuarios (efecto persiana): profesores y
            // administradores ya pueden revelarse sin esperar a `students`.
            startProgressiveUserLoading([], c, u);

            loadStudents()
                .then(async (loaded) => {
                    const s = withBiometrics(loaded, await biometricFlags);
                    if (cancelled) return;
                    setStudents(s);
                    startProgressiveUserLoading(s, c, u);
                })
                .catch((err) => {
                    if (cancelled) return;
                    console.error("[FaceAttend] AppDataContext: carga de estudiantes fallida —", err?.message);
                    setLoadError((prev) => prev ?? err?.message ?? "error desconocido");
                });
        });

        return () => {
            cancelled = true;
            clearInterval(revealTimer.current); // corta un revelado a medias
        };
    }, [isLoadingAuth, user, startProgressiveUserLoading]);

    // ── Programs derivados (sin storage propio) ───────────

    const programs = useMemo(() => {
        const byId = new Map(courses.map((c) => [String(c.id), c]));
        const map = new Map();
        // Usar loadedStudents para que se actualice progresivamente
        for (const s of loadedStudents) {
            if (!s.course?.trim()) continue;

            // Se agrupa por courseId, no por nombre: "Lengua Castellana" existe una vez
            // por sede, y agrupar por nombre fundia las dos en una sola fila sumando los
            // estudiantes de ambas.
            const course = s.courseId ? byId.get(s.courseId) : null;
            const key = course ? String(course.id) : s.course;

            if (!map.has(key)) {
                map.set(key, { attendance: [], active: 0, code: course?.code ?? s.course, name: course?.name ?? s.course });
            }
            const entry = map.get(key);
            entry.attendance.push(s.attendance);
            if (s.status === "active") entry.active += 1;
        }
        return Array.from(map.values())
            .map(({ attendance, active, code, name }) => ({
                name,
                code, // Incluir el código del curso
                studentCount: attendance.length,
                avgAttendance: Math.round(attendance.reduce((a, b) => a + b, 0) / attendance.length),
                activeCount: active,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [loadedStudents, courses]);

    // ── Students ──────────────────────────────────────────

    // Trae la lista real de estudiantes del backend. Igual que
    // reloadUsersFn/reloadCoursesFn: tras una alta masiva (importStudents)
    // la fila real no aparece hasta esto, porque no hay espejo local que
    // la muestre de inmediato.
    const reloadStudentsFn = useCallback(async () => {
        const fresh = await loadStudents();
        setStudents(fresh);
        startProgressiveUserLoading(fresh, courses, users);
    }, [courses, users, startProgressiveUserLoading]);

    const addStudentFn = useCallback(
        async (draft) => {
            const updated = await storageAddStudent(students, draft);
            
            // Enriquecer: estudiantes heredan período del curso
            const enrichedUpdated = updated.map(student => {
                const studentCourse = enrichedCourses.find(
                    c => c.code === student.course || c.name === student.course || c.id === student.course
                );
                return {
                    ...student,
                    grade: studentCourse?.currentPeriod || student.grade || '—',
                    periodInfo: studentCourse?.periodInfo || null,
                };
            });
            
            setStudents(enrichedUpdated);
            setLoadedStudents(enrichedUpdated);
        },
        [students, enrichedCourses]
    );

    const importStudentsFn = useCallback(
        async (drafts) => {
            if (drafts.length === 0) return 0;
            const updated = await storageAddStudentsBulk(students, drafts);
            
            // Enriquecer: estudiantes heredan período del curso
            const enrichedUpdated = updated.map(student => {
                const studentCourse = enrichedCourses.find(
                    c => c.code === student.course || c.name === student.course || c.id === student.course
                );
                return {
                    ...student,
                    grade: studentCourse?.currentPeriod || student.grade || '—',
                    periodInfo: studentCourse?.periodInfo || null,
                };
            });
            
            setStudents(enrichedUpdated);
            setLoadedStudents(enrichedUpdated);
            
            return drafts.length;
        },
        [students, enrichedCourses]
    );

    const updateStudentFn = useCallback(
        async (id, patch) => {
            // Actualizar en ambos estados: students (interno) y loadedStudents (expuesto)
            const updateStudentInArray = (studentArray) => {
                return studentArray.map((s) => (s.id === id ? { ...s, ...patch } : s));
            };
            
            const updatedStudents = updateStudentInArray(students);
            const updatedLoadedStudents = updateStudentInArray(loadedStudents);
            
            // Re-heredar período del curso para el estudiante actualizado
            const enrichStudent = (student) => {
                if (student.id === id) {
                    const studentCourse = enrichedCourses.find(
                        c => c.code === student.course || c.name === student.course || c.id === student.course
                    );
                    return {
                        ...student,
                        grade: studentCourse?.currentPeriod || student.grade || '—',
                        periodInfo: studentCourse?.periodInfo || null,
                    };
                }
                return student;
            };
            
            const enrichedStudents = updatedStudents.map(enrichStudent);
            const enrichedLoadedStudents = updatedLoadedStudents.map(enrichStudent);
            
            // Persistir y actualizar estados
            await saveStudents(enrichedStudents);
            setStudents(enrichedStudents);
            setLoadedStudents(enrichedLoadedStudents);
            
            // Forzar un refresh para asegurar que la UI se actualice
            setTimeout(() => {
                forceRefresh();
            }, 100);
        },
        [students, loadedStudents, enrichedCourses, forceRefresh]
    );

    const removeStudentFn = useCallback(
        async (id) => {
            const updated = students.filter((s) => s.id !== id);
            await saveStudents(updated);
            setStudents(updated);
            setLoadedStudents(prev => prev.filter(s => s.id !== id));
        },
        [students]
    );

    // ── Users ─────────────────────────────────────────────

    const addUserFn = useCallback(
        async (draft) => {
            const updated = await storageAddUser(users, draft);
            setUsers(updated);
        },
        [users]
    );

    // Trae la lista real de usuarios desde el backend. A diferencia de
    // addUserFn (que fabrica una fila local), esta es la fuente de verdad:
    // se usa tras dar de alta un docente/admin en el backend (provisionStaff)
    // para que la fila que aparece sea la real (mismo username que confirmó
    // el backend) y no un duplicado que persiste para siempre en AsyncStorage.
    const reloadUsersFn = useCallback(async () => {
        const freshUsers = await loadUsers();
        setUsers(freshUsers);
        startProgressiveUserLoading(students, courses, freshUsers);
    }, [students, courses, startProgressiveUserLoading]);

    const updateUserFn = useCallback(
        async (id, patch) => {
            console.log('updateUserFn: Actualizando usuario', id, 'con patch:', patch);
            const updated = await storageUpdateUser(users, id, patch);
            setUsers(updated);
            
            // Forzar un refresh para asegurar que la UI se actualice
            setTimeout(() => {
                forceRefresh();
            }, 100);
        },
        [users, forceRefresh]
    );

    // Parchea la fila visible en la lista de su tipo (estudiantes,
    // docentes o administradores) tras una edición en el backend.
    const patchStaffFn = useCallback((userType, id, patch) => {
        const apply = (prev) => prev.map((u) => (String(u.id) === String(id) ? { ...u, ...patch } : u));
        if (userType === "teacher") setLoadedTeachers(apply);
        else if (userType === "admin") setLoadedAdmins(apply);
        else setLoadedStudents(apply);
    }, []);

    // Refleja en la lista (estudiantes, docentes, administradores) lo que acaba
    // de quedar registrado en ms-biometric para esa persona.
    const patchBiometricsFn = useCallback((personId, patch) => {
        if (!personId) return;
        const apply = (prev) =>
            prev.map((u) => (String(u.personId) === String(personId) ? { ...u, ...patch } : u));
        setLoadedStudents(apply);
        setLoadedTeachers(apply);
        setLoadedAdmins(apply);
    }, []);

    const removeUserFn = useCallback(
        async (id) => {
            const updated = await storageDeleteUser(users, id);
            setUsers(updated);
        },
        [users]
    );

    // ── Environments ──────────────────────────────────────

    const addEnvironmentFn = useCallback(
        async (draft) => {
            const updated = await storageAddEnvironment(environments, draft);
            setEnvironments(updated);
        },
        [environments]
    );

    const updateEnvironmentFn = useCallback(
        async (id, patch) => {
            const updated = await storageUpdateEnvironment(environments, id, patch);
            setEnvironments(updated);
        },
        [environments]
    );

    const removeEnvironmentFn = useCallback(
        async (id) => {
            const updated = await storageDeleteEnvironment(environments, id);
            setEnvironments(updated);
        },
        [environments]
    );

    const addScheduleFn = useCallback(
        async (envId, draft) => {
            const updated = await addScheduleToEnvironment(environments, envId, draft);
            setEnvironments(updated);
        },
        [environments]
    );

    const updateScheduleFn = useCallback(
        async (envId, scheduleId, patch) => {
            const updated = await updateSchedule(environments, envId, scheduleId, patch);
            setEnvironments(updated);
        },
        [environments]
    );

    const removeScheduleFn = useCallback(
        async (envId, scheduleId) => {
            const updated = await deleteSchedule(environments, envId, scheduleId);
            setEnvironments(updated);
        },
        [environments]
    );

    // ── Fichas ────────────────────────────────────────────

    const addFichaFn = useCallback(
        async (draft) => {
            const updated = await storageAddFicha(fichas, draft);
            setFichas(updated);
        },
        [fichas]
    );

    const updateFichaFn = useCallback(
        async (id, patch) => {
            const updated = await storageUpdateFicha(fichas, id, patch);
            setFichas(updated);
        },
        [fichas]
    );

    const removeFichaFn = useCallback(
        async (id) => {
            const updated = await storageDeleteFicha(fichas, id);
            setFichas(updated);
        },
        [fichas]
    );

    // ── Courses ───────────────────────────────────────────

    const addCourseFn = useCallback(
        async (draft) => {
            const updated = await storageAddCourse(courses, draft);
            setCourses(updated);
        },
        [courses]
    );

    // Trae la lista real de cursos del backend. Igual que reloadUsersFn:
    // un espejo local fabricado tras crear el curso quedaba duplicado para
    // siempre junto al que luego trae loadCourses() desde la API.
    const reloadCoursesFn = useCallback(async () => {
        const fresh = await loadCourses();
        setCourses(fresh);
    }, []);

    const updateCourseFn = useCallback(
        async (id, patch) => {
            const updated = await storageUpdateCourse(courses, id, patch);
            setCourses(updated);
        },
        [courses]
    );

    const removeCourseFn = useCallback(
        async (id) => {
            const updated = await storageDeleteCourse(courses, id);
            setCourses(updated);
        },
        [courses]
    );

    // ── Valor del contexto ────────────────────────────────

    const value = useMemo(
        () => ({
            isLoading: isLoading || isLoadingUsers, // Incluye carga progresiva de usuarios
            loadError,

            students: loadedStudents, // Usuarios cargados progresivamente
            addStudent: addStudentFn,
            importStudents: importStudentsFn,
            reloadStudents: reloadStudentsFn,
            updateStudent: updateStudentFn,
            removeStudent: removeStudentFn,

            teachers: loadedTeachers, // Profesores cargados progresivamente
            admins: loadedAdmins,     // Administradores cargados progresivamente

            programs,

            users,
            addUser: addUserFn,
            reloadUsers: reloadUsersFn,
            updateUser: updateUserFn,
            removeUser: removeUserFn,
            patchStaff: patchStaffFn,
            patchBiometrics: patchBiometricsFn,

            environments,
            addEnvironment: addEnvironmentFn,
            updateEnvironment: updateEnvironmentFn,
            removeEnvironment: removeEnvironmentFn,

            addSchedule: addScheduleFn,
            updateSchedule: updateScheduleFn,
            removeSchedule: removeScheduleFn,

            fichas,
            addFicha: addFichaFn,
            updateFicha: updateFichaFn,
            removeFicha: removeFichaFn,

            courses: enrichedCourses, // Cursos enriquecidos con período calculado
            addCourse: addCourseFn,
            reloadCourses: reloadCoursesFn,
            updateCourse: updateCourseFn,
            removeCourse: removeCourseFn,
            
            // Utilidades
            forceRefresh,
        }),
        [
            isLoading,
            isLoadingUsers,
            loadError,
            loadedStudents,
            loadedTeachers,
            loadedAdmins,
            addStudentFn,
            importStudentsFn,
            reloadStudentsFn,
            updateStudentFn,
            removeStudentFn,
            programs,
            users,
            addUserFn,
            reloadUsersFn,
            updateUserFn,
            removeUserFn,
            patchStaffFn,
            patchBiometricsFn,
            environments,
            addEnvironmentFn,
            updateEnvironmentFn,
            removeEnvironmentFn,
            addScheduleFn,
            updateScheduleFn,
            removeScheduleFn,
            fichas,
            addFichaFn,
            updateFichaFn,
            removeFichaFn,
            enrichedCourses,
            addCourseFn,
            reloadCoursesFn,
            updateCourseFn,
            removeCourseFn,
            forceRefresh,
            refreshTrigger, // Incluir refreshTrigger para forzar re-cálculos
        ]
    );

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────

export function useAppData() {
    const ctx = useContext(AppDataContext);
    if (!ctx) {
        throw new Error(
            "[FaceAttend] useAppData() debe usarse dentro de <AppDataProvider>. " +
                "Envuelve tu app con <AppDataProvider> en app.tsx."
        );
    }
    return ctx;
}
