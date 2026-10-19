// ============================================================
//  FaceAttend EDU — useCourseDetails Hook
//
//  Hook reutilizable que centraliza toda la lógica de cálculo
//  de información dinámica de un curso.
//
//  Usado por:
//  - CourseDetailModal (modal de detalle)
//  - CourseCard (tarjeta de preview)
//
//  Evita duplicación y mantiene consistencia.
// ============================================================

import { useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useDateFormat } from "../../view/components/hooks/useDateFormat";

/**
 * Obtiene el día actual en formato corto español
 */
function getCurrentDay() {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return days[new Date().getDay()];
}

/**
 * Obtiene el día de mañana en formato corto español
 */
function getTomorrowDay() {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return days[tomorrow.getDay()];
}

/**
 * Obtiene la hora actual como Date object
 */
function getCurrentTimeAsDate() {
    return new Date();
}

/**
 * Convierte un string de tiempo (HH:MM) a minutos desde medianoche
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Compara si la hora actual está dentro de un rango
 */
function isTimeInRange(startTime, endTime) {
    const now = getCurrentTimeAsDate();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Verifica si la hora actual ya pasó un horario
 */
function isTimePast(endTime) {
    const now = getCurrentTimeAsDate();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const endMinutes = timeToMinutes(endTime);
    
    return currentMinutes > endMinutes;
}

/**
 * Encuentra el horario activo actual basándose en día y hora
 */
function findActiveSchedule(schedules) {
    if (!schedules || schedules.length === 0) return null;
    
    const currentDay = getCurrentDay();
    
    return schedules.find(schedule => {
        if (!schedule.days || !schedule.days.includes(currentDay)) return false;
        return isTimeInRange(schedule.startTime, schedule.endTime);
    });
}

/**
 * Encuentra horarios que ya pasaron hoy
 */
function findPastSchedulesToday(schedules) {
    if (!schedules || schedules.length === 0) return [];
    
    const currentDay = getCurrentDay();
    
    return schedules.filter(schedule => {
        if (!schedule.days || !schedule.days.includes(currentDay)) return false;
        return isTimePast(schedule.endTime);
    });
}

/**
 * Encuentra horarios programados para mañana
 */
function findTomorrowSchedules(schedules) {
    if (!schedules || schedules.length === 0) return [];
    
    const tomorrowDay = getTomorrowDay();
    
    return schedules.filter(schedule => 
        schedule.days && schedule.days.includes(tomorrowDay)
    );
}

/**
 * Encuentra el próximo día de clase y calcula cuántos días faltan
 */
function findNextScheduleWithDays(schedules) {
    if (!schedules || schedules.length === 0) return null;
    
    const daysOrder = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const currentDayIndex = new Date().getDay();
    
    let minDaysUntil = Infinity;
    let nextSchedule = null;
    
    schedules.forEach(schedule => {
        if (!schedule.days || schedule.days.length === 0) return;
        
        schedule.days.forEach(day => {
            const dayIndex = daysOrder.indexOf(day);
            if (dayIndex === -1) return;
            
            let daysUntil = dayIndex - currentDayIndex;
            if (daysUntil <= 0) {
                daysUntil += 7; // Próxima semana
            }
            
            if (daysUntil < minDaysUntil) {
                minDaysUntil = daysUntil;
                nextSchedule = schedule;
            }
        });
    });
    
    return nextSchedule ? { daysUntil: minDaysUntil, schedule: nextSchedule } : null;
}

/**
 * Hook que calcula toda la información dinámica de un curso
 * 
 * @param {Object} course - Objeto del curso
 * @returns {Object} Información calculada del curso
 */
export function useCourseDetails(course) {
    const { environments, students } = useAppData();
    const { formatDate } = useDateFormat();

    // Buscar ambiente(s) asociado(s) al curso
    const courseEnvironments = useMemo(() => {
        if (!course || !course.code || !environments) return [];
        
        return environments.filter(env => 
            env.schedules?.some(sch => 
                sch.courseCode === course.code || 
                sch.courseName === course.name
            )
        );
    }, [course, environments]);

    // Obtener todos los horarios del curso desde todos sus ambientes
    const allSchedules = useMemo(() => {
        if (!course || !course.code) return [];
        
        return courseEnvironments.flatMap(env => 
            (env.schedules || []).filter(sch => 
                sch.courseCode === course.code || 
                sch.courseName === course.name
            ).map(sch => ({
                ...sch,
                environmentId: env.id,
                environmentName: env.number,
            }))
        );
    }, [course, courseEnvironments]);

    // Determinar horario activo actual
    const activeSchedule = useMemo(() => {
        return findActiveSchedule(allSchedules);
    }, [allSchedules]);

    // Determinar horarios pasados hoy
    const pastSchedulesToday = useMemo(() => {
        return findPastSchedulesToday(allSchedules);
    }, [allSchedules]);

    // Determinar horarios de mañana
    const tomorrowSchedules = useMemo(() => {
        return findTomorrowSchedules(allSchedules);
    }, [allSchedules]);

    // Determinar próximo horario y días hasta la clase
    const nextScheduleInfo = useMemo(() => {
        return findNextScheduleWithDays(allSchedules);
    }, [allSchedules]);

    // Docente dinámico con contexto inteligente
    const currentInstructor = useMemo(() => {
        if (!course) return '—';
        
        // 1. Si hay clase ahora mismo
        if (activeSchedule?.instructorName) {
            return `${activeSchedule.instructorName} (ahora)`;
        }
        
        // 2. Si ya hubo clase hoy (pasó)
        if (pastSchedulesToday.length > 0) {
            const instructor = pastSchedulesToday[0].instructorName;
            if (instructor) {
                return `${instructor} (estuvo hoy)`;
            }
        }
        
        // 3. Si hay clase mañana
        if (tomorrowSchedules.length > 0) {
            const instructor = tomorrowSchedules[0].instructorName;
            if (instructor) {
                return `Mañana con ${instructor}`;
            }
        }
        
        // 4. Verificar cuándo es la próxima clase
        if (nextScheduleInfo) {
            const { daysUntil, schedule } = nextScheduleInfo;
            const instructor = schedule.instructorName;
            
            if (instructor) {
                // Si la próxima clase está dentro de 2 días (no hoy ni mañana)
                if (daysUntil <= 2) {
                    return `Próxima clase con ${instructor}`;
                }
                // Si la próxima clase está a más de 2 días
                else {
                    return `Última vez con ${instructor}`;
                }
            }
        }
        
        // 5. Fallback al profesor base del curso
        return course.professor || '—';
    }, [course, activeSchedule, pastSchedulesToday, tomorrowSchedules, nextScheduleInfo]);

    // Aula dinámica con contexto inteligente
    const currentRoom = useMemo(() => {
        if (!course) return '—';
        
        // 1. Si hay clase ahora mismo
        if (activeSchedule?.environmentName) {
            return `En ${activeSchedule.environmentName} (ahora)`;
        }
        
        // 2. Si ya hubo clase hoy (pasó)
        if (pastSchedulesToday.length > 0) {
            const room = pastSchedulesToday[0].environmentName;
            if (room) {
                return `En ${room} (estuvieron hoy)`;
            }
        }
        
        // 3. Si hay clase mañana (sin "Mañana", solo "En")
        if (tomorrowSchedules.length > 0) {
            const room = tomorrowSchedules[0].environmentName;
            if (room) {
                return `En ${room}`;
            }
        }
        
        // 4. Cualquier otro caso (próxima clase o última vez)
        if (courseEnvironments.length > 0) {
            const rooms = courseEnvironments.map(env => env.number);
            
            if (rooms.length > 0) {
                return `En ${rooms.join(', ')}`;
            }
        }
        
        // 5. Fallback al aula base del curso
        return course.room || '—';
    }, [course, activeSchedule, pastSchedulesToday, tomorrowSchedules, courseEnvironments]);

    // Contar estudiantes reales vinculados al curso
    const enrolledStudentsCount = useMemo(() => {
        if (!course || !students) return 0;
        
        return students.filter(student => 
            student.course === course.code || 
            student.course === course.name || 
            student.course === course.id
        ).length;
    }, [course, students]);

    // Calcular promedio de asistencia real de los estudiantes del curso
    const courseAvgAttendance = useMemo(() => {
        if (!course || !students) return 0;
        
        const courseStudents = students.filter(student => 
            student.course === course.code || 
            student.course === course.name || 
            student.course === course.id
        );
        
        if (courseStudents.length === 0) return 0;
        
        const totalAttendance = courseStudents.reduce((sum, student) => 
            sum + (student.attendance || 0), 0
        );
        
        return Math.round(totalAttendance / courseStudents.length);
    }, [course, students]);

    // Jornada del curso (heredada de course.schedule)
    const courseShift = useMemo(() => {
        if (!course) return '—';
        
        const schedule = course.schedule?.toLowerCase();
        
        // Mapear a formato capitalizado
        const shiftMap = {
            'mañana': 'Mañana',
            'manana': 'Mañana',
            'tarde': 'Tarde',
            'noche': 'Noche',
            'mixta': 'Mixta',
        };
        
        return shiftMap[schedule] || course.schedule || '—';
    }, [course]);

    // Período/Semestre con fechas formateadas
    const coursePeriodDisplay = useMemo(() => {
        if (!course) return '—';
        
        // Mostrar el período actual si existe
        const periodLabel = course.currentPeriod || course.semester;
        
        // Agregar fechas si existen
        if (course.startDate && course.endDate) {
            const startFormatted = formatDate(new Date(course.startDate));
            const endFormatted = formatDate(new Date(course.endDate));
            
            return `${periodLabel}\n${startFormatted} - ${endFormatted}`;
        }
        
        return periodLabel || '—';
    }, [course, formatDate]);

    return {
        // Información básica calculada
        currentInstructor,
        currentRoom,
        enrolledStudentsCount,
        courseAvgAttendance,
        courseShift,
        coursePeriodDisplay,
        
        // Información de contexto (por si se necesita)
        courseEnvironments,
        allSchedules,
        activeSchedule,
        pastSchedulesToday,
        tomorrowSchedules,
        nextScheduleInfo,
    };
}
