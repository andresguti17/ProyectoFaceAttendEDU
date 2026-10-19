// ============================================================
//  FaceAttend EDU — Mock Data (Model Layer)
//  Reemplaza cada export con una llamada real a tu API.
//  Las ViewModels importan desde aquí, nunca las Views directamente.
// ============================================================

// ── Utilidad: Calcular fecha de última asistencia simulada ──
// Esta función crea una distribución realista de días sin asistir
// que respeta los umbrales configurables del sistema
function getSimulatedLastAttendance(attendanceRate) {
    const today = new Date();
    let daysAgo = 0;
    
    // Distribución realista basada en porcentaje de asistencia
    // Los estudiantes con baja asistencia tienen más probabilidad de
    // tener días recientes sin asistir, pero con variedad
    if (attendanceRate >= 95) {
        daysAgo = 0; // Hoy (asistencia excelente)
    } else if (attendanceRate >= 90) {
        daysAgo = Math.random() < 0.7 ? 0 : 1; // 70% hoy, 30% hace 1 día
    } else if (attendanceRate >= 85) {
        daysAgo = Math.floor(Math.random() * 2); // 0-1 días
    } else if (attendanceRate >= 80) {
        daysAgo = Math.floor(Math.random() * 2) + 1; // 1-2 días
    } else if (attendanceRate >= 75) {
        daysAgo = Math.floor(Math.random() * 3) + 1; // 1-3 días
    } else if (attendanceRate >= 70) {
        daysAgo = Math.floor(Math.random() * 3) + 2; // 2-4 días
    } else if (attendanceRate >= 65) {
        daysAgo = Math.floor(Math.random() * 4) + 2; // 2-5 días
    } else if (attendanceRate >= 60) {
        daysAgo = Math.floor(Math.random() * 4) + 3; // 3-6 días
    } else if (attendanceRate >= 55) {
        daysAgo = Math.floor(Math.random() * 5) + 4; // 4-8 días
    } else {
        // Muy baja asistencia: distribución amplia
        daysAgo = Math.floor(Math.random() * 7) + 5; // 5-11 días
    }
    
    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() - daysAgo);
    return lastDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ── Utilidad: Generar historial de asistencia simulado ──
// Genera un historial realista que incluye rachas de ausencias consecutivas
function generateAttendanceHistory(attendanceRate, totalClasses = 45) {
    const history = [];
    const today = new Date();
    const attendedClasses = Math.round((attendanceRate / 100) * totalClasses);
    const missedClasses = totalClasses - attendedClasses;
    
    // Determinar si debe tener ausencias consecutivas recientes
    // Estudiantes con baja asistencia tienen mayor probabilidad de rachas
    const hasRecentAbsenceStreak = attendanceRate < 75 && Math.random() < 0.6;
    const streakLength = hasRecentAbsenceStreak 
        ? Math.min(Math.floor(Math.random() * 4) + 2, 5) // 2-5 días
        : 0;
    
    let remainingAbsences = missedClasses;
    
    // Generar historial retrocediendo desde hoy
    for (let i = totalClasses - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - (totalClasses - i - 1) * 2); // Clases cada 2 días
        
        let present = true;
        
        // Generar racha de ausencias recientes si aplica
        if (hasRecentAbsenceStreak && i >= totalClasses - streakLength) {
            present = false;
            remainingAbsences--;
        } else {
            // Distribuir ausencias aleatoriamente en el resto del historial
            const remainingSlots = i + 1;
            const probabilityOfAbsence = remainingSlots > 0 
                ? Math.min(remainingAbsences / remainingSlots, 0.4) // Max 40% probabilidad
                : 0;
            
            if (remainingAbsences > 0 && Math.random() < probabilityOfAbsence) {
                present = false;
                remainingAbsences--;
            }
        }
        
        // Determinar tardanzas (solo si asistió)
        const late = present && Math.random() < 0.08; // 8% de tardanzas
        
        // Simular horas de entrada y salida realistas
        let checkInTime = null;
        let checkOutTime = null;
        
        if (present) {
            // Hora de entrada: 7:00-9:00 para jornada mañana, 13:00-15:00 para tarde
            const baseCheckIn = Math.random() < 0.5 ? 8 : 14; // 50% mañana, 50% tarde
            const checkInMinutes = late 
                ? Math.floor(Math.random() * 30) + 10 // 10-40 min tarde si late=true
                : Math.floor(Math.random() * 15); // 0-15 min variación normal
            
            const checkInHour = baseCheckIn + Math.floor(checkInMinutes / 60);
            const checkInMin = checkInMinutes % 60;
            checkInTime = `${checkInHour.toString().padStart(2, '0')}:${checkInMin.toString().padStart(2, '0')}`;
            
            // Hora de salida: 2-4 horas después de la entrada
            const duration = Math.floor(Math.random() * 120) + 120; // 120-240 min (2-4 horas)
            const totalMinutes = checkInHour * 60 + checkInMin + duration;
            const checkOutHour = Math.floor(totalMinutes / 60);
            const checkOutMin = totalMinutes % 60;
            checkOutTime = `${checkOutHour.toString().padStart(2, '0')}:${checkOutMin.toString().padStart(2, '0')}`;
        }
        
        history.push({
            date: date.toISOString().split('T')[0],
            present,
            late,
            checkInTime,   // Hora real de entrada (ej: "08:05", "14:23")
            checkOutTime,  // Hora real de salida (ej: "10:30", "17:45")
        });
    }
    
    // Asegurar que el historial esté ordenado cronológicamente (más antiguo → más reciente)
    return history.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export const mockStudents = [
    {
        id: "1",
        name: "María García López",
        email: "m.garcia@uni.edu",
        code: "AED-401001",
        course: "AED-401", // Algoritmos y Estructuras de Datos (curso con código)
        grade: null, // Será calculado dinámicamente
        attendance: 92,
        lastAttendanceDate: getSimulatedLastAttendance(92),
        attendanceHistory: generateAttendanceHistory(92),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "2",
        name: "Carlos Rodríguez Mora",
        email: "c.rodriguez@uni.edu",
        code: "AED-401002",
        course: "AED-401", // Algoritmos y Estructuras de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 88,
        lastAttendanceDate: getSimulatedLastAttendance(88),
        attendanceHistory: generateAttendanceHistory(88),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "3",
        name: "Ana Martínez Ríos",
        email: "a.martinez@uni.edu",
        code: "MAT-201001",
        course: "MAT-201", // Cálculo Diferencial
        grade: null, // Será calculado dinámicamente
        attendance: 95,
        lastAttendanceDate: getSimulatedLastAttendance(95),
        attendanceHistory: generateAttendanceHistory(95),
        status: "active",
        hasFacial: true,
        hasFingerprint: false, // Solo tiene facial
    },
    {
        id: "4",
        name: "Luis Herrera Díaz",
        email: "l.herrera@uni.edu",
        code: "FIS-101001",
        course: "FIS-101", // Física I
        grade: null, // Será calculado dinámicamente
        attendance: 75,
        lastAttendanceDate: getSimulatedLastAttendance(75),
        attendanceHistory: generateAttendanceHistory(75),
        status: "active",
        hasFacial: false,
        hasFingerprint: false, // No tiene ninguno
    },
    {
        id: "5",
        name: "Sofia Pérez Muñoz",
        email: "s.perez@uni.edu",
        code: "POO-301001",
        course: "POO-301", // Programación Orientada a Objetos
        grade: null, // Será calculado dinámicamente
        attendance: 60,
        lastAttendanceDate: getSimulatedLastAttendance(60),
        attendanceHistory: generateAttendanceHistory(60),
        status: "inactive",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "6",
        name: "Andrés Vargas Castro",
        email: "a.vargas@uni.edu",
        code: "BD-401001",
        course: "BD-401", // Bases de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 85,
        lastAttendanceDate: getSimulatedLastAttendance(85),
        attendanceHistory: generateAttendanceHistory(85),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "7",
        name: "Valentina Cruz Lozano",
        email: "v.cruz@uni.edu",
        code: "AED-401003",
        course: "AED-401", // Algoritmos y Estructuras de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 91,
        lastAttendanceDate: getSimulatedLastAttendance(91),
        attendanceHistory: generateAttendanceHistory(91),
        status: "active",
        hasFacial: false,
        hasFingerprint: true, // Solo tiene huella
    },
    {
        id: "8",
        name: "Daniel Ramírez Pinto",
        email: "d.ramirez@uni.edu",
        code: "PD-101001",
        course: "PD-101", // Pizzas de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 78,
        lastAttendanceDate: getSimulatedLastAttendance(78),
        attendanceHistory: generateAttendanceHistory(78),
        status: "active",
        hasFacial: false,
        hasFingerprint: false,
    },
    // ── Estudiantes adicionales para listas del dashboard ────
    {
        id: "9",
        name: "Andrea Morales Cruz",
        email: "a.morales@uni.edu",
        code: "PD-101002",
        course: "PD-101", // Pizzas de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 68,
        lastAttendanceDate: getSimulatedLastAttendance(68),
        attendanceHistory: generateAttendanceHistory(68),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "10",
        name: "Roberto Silva Gómez",
        email: "r.silva@uni.edu",
        code: "FIS-101002",
        course: "FIS-101", // Física I
        grade: null, // Será calculado dinámicamente
        attendance: 73,
        lastAttendanceDate: getSimulatedLastAttendance(73),
        attendanceHistory: generateAttendanceHistory(73),
        status: "active",
        hasFacial: true,
        hasFingerprint: false,
    },
    {
        id: "11",
        name: "Camila Ruiz Torres",
        email: "c.ruiz@uni.edu",
        code: "MAT-201002",
        course: "MAT-201", // Cálculo Diferencial
        grade: null, // Será calculado dinámicamente
        attendance: 97.5,
        lastAttendanceDate: getSimulatedLastAttendance(97.5),
        attendanceHistory: generateAttendanceHistory(97.5),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "12",
        name: "Santiago Ospina León",
        email: "s.ospina@uni.edu",
        code: "BD-401002",
        course: "BD-401", // Bases de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 96.7,
        lastAttendanceDate: getSimulatedLastAttendance(96.7),
        attendanceHistory: generateAttendanceHistory(96.7),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    // ── Estudiantes nuevos (8 más para probar funcionalidad) ────
    {
        id: "13",
        name: "Isabella Moreno Ruiz",
        email: "i.moreno@uni.edu",
        code: "AED-401004",
        course: "AED-401", // Algoritmos y Estructuras de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 94,
        lastAttendanceDate: getSimulatedLastAttendance(94),
        attendanceHistory: generateAttendanceHistory(94),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "14",
        name: "Mateo Fernández Castro",
        email: "m.fernandez@uni.edu",
        code: "POO-301002",
        course: "POO-301", // Programación Orientada a Objetos
        grade: null, // Será calculado dinámicamente
        attendance: 89,
        lastAttendanceDate: getSimulatedLastAttendance(89),
        attendanceHistory: generateAttendanceHistory(89),
        status: "active",
        hasFacial: false,
        hasFingerprint: true,
    },
    {
        id: "15",
        name: "Lucía Jiménez Parra",
        email: "l.jimenez@uni.edu",
        code: "MAT-201003",
        course: "MAT-201", // Cálculo Diferencial
        grade: null, // Será calculado dinámicamente
        attendance: 55,
        lastAttendanceDate: getSimulatedLastAttendance(55),
        attendanceHistory: generateAttendanceHistory(55),
        status: "active",
        hasFacial: false,
        hasFingerprint: false,
    },
    {
        id: "16",
        name: "Diego Ramírez Ortiz",
        email: "d.ramirez2@uni.edu",
        code: "FIS-101003",
        course: "FIS-101", // Física I
        grade: null, // Será calculado dinámicamente
        attendance: 82,
        lastAttendanceDate: getSimulatedLastAttendance(82),
        attendanceHistory: generateAttendanceHistory(82),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "17",
        name: "Valentina Sánchez Mejía",
        email: "v.sanchez@uni.edu",
        code: "PD-101003",
        course: "PD-101", // Pizzas de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 98,
        lastAttendanceDate: getSimulatedLastAttendance(98),
        attendanceHistory: generateAttendanceHistory(98),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "18",
        name: "Sebastián Torres Ávila",
        email: "s.torres@uni.edu",
        code: "FIS-101004",
        course: "FIS-101", // Física I
        grade: null, // Será calculado dinámicamente
        attendance: 65,
        lastAttendanceDate: getSimulatedLastAttendance(65),
        attendanceHistory: generateAttendanceHistory(65),
        status: "active",
        hasFacial: true,
        hasFingerprint: false,
    },
    {
        id: "19",
        name: "Emma Rodríguez Villa",
        email: "e.rodriguez@uni.edu",
        code: "MAT-201004",
        course: "MAT-201", // Cálculo Diferencial
        grade: null, // Será calculado dinámicamente
        attendance: 93,
        lastAttendanceDate: getSimulatedLastAttendance(93),
        attendanceHistory: generateAttendanceHistory(93),
        status: "active",
        hasFacial: true,
        hasFingerprint: true,
    },
    {
        id: "20",
        name: "Nicolás Gómez Peña",
        email: "n.gomez@uni.edu",
        code: "BD-401003",
        course: "BD-401", // Bases de Datos
        grade: null, // Será calculado dinámicamente
        attendance: 71,
        lastAttendanceDate: getSimulatedLastAttendance(71),
        attendanceHistory: generateAttendanceHistory(71),
        status: "active",
        hasFacial: false,
        hasFingerprint: false,
    },
];

export const mockCourses = [
    {
        id: "1",
        name: "Algoritmos y Estructuras de Datos",
        code: "AED-401",
        professor: "Dr. Felipe Torres",
        students: 45,
        schedule: "mañana",
        room: "env1", // ID del ambiente "301"
        startDate: "2025-02-10",
        endDate: "2027-04-11",
        semester: "2024-2",
        avgAttendance: 87,
        status: "active",
        color: "#4F6BED",
    },
    {
        id: "2",
        name: "Cálculo Diferencial",
        code: "MAT-201",
        professor: "Dra. Patricia Soto",
        students: 38,
        schedule: "tarde",
        room: "env2", // ID del ambiente "105"
        startDate: "2024-08-01",
        endDate: "2026-12-31",
        semester: "2024-2",
        avgAttendance: 92,
        status: "active",
        color: "#10B981",
    },
    {
        id: "3",
        name: "Física I",
        code: "FIS-101",
        professor: "Dr. Mauricio Reyes",
        students: 42,
        schedule: "mañana",
        room: "env3", // ID del ambiente "Lab. Física"
        startDate: "2026-01-15",
        endDate: "2026-06-30",
        semester: "2024-2",
        avgAttendance: 65, // Cambiado de 78 a 65 para probar alertas
        status: "active",
        color: "#F59E0B",
    },
    {
        id: "4",
        name: "Programación Orientada a Objetos",
        code: "POO-301",
        professor: "Ing. Sandra Varela",
        students: 35,
        schedule: "tarde",
        room: "env4", // ID del ambiente "Lab. Computación"
        startDate: "2025-07-01",
        endDate: "2027-01-15",
        semester: "2024-2",
        avgAttendance: 55, // Cambiado de 85 a 55 para probar alertas críticas
        status: "active",
        color: "#8B5CF6",
    },
    {
        id: "5",
        name: "Bases de Datos",
        code: "BD-401",
        professor: "Dr. Hugo Méndez",
        students: 40,
        schedule: "mañana",
        room: "env4", // ID del ambiente "Lab. Computación"
        startDate: "2024-01-15",
        endDate: "2025-07-30",
        semester: "2024-2",
        avgAttendance: 90,
        status: "active",
        color: "#EF4444",
    },
    {
        id: "6",
        name: "Pizzas de Datos",
        code: "PD-101",
        professor: "Dr. Hugo Verdosa",
        students: 30,
        schedule: "mañana",
        room: "env1", // ID del ambiente "301"
        startDate: "2026-03-01",
        endDate: "2027-11-30",
        semester: "2024-2",
        avgAttendance: 83,
        status: "active",
        color: "#EF4444",
    },
];

export const mockAttendanceByDay = [
    { day: "Lun", present: 120, absent: 15, late: 8 },
    { day: "Mar", present: 115, absent: 18, late: 12 },
    { day: "Mié", present: 125, absent: 10, late: 6 },
    { day: "Jue", present: 110, absent: 20, late: 14 },
    { day: "Vie", present: 118, absent: 16, late: 9 },
];

export const mockAttendanceByWeek = [
    { 
        week: "Sem 1", 
        rate: 88,
        dailyData: [
            { day: "Lun", present: 105, late: 8, absent: 12 },
            { day: "Mar", present: 110, late: 6, absent: 9 },
            { day: "Mié", present: 108, late: 10, absent: 7 },
            { day: "Jue", present: 102, late: 12, absent: 11 },
            { day: "Vie", present: 106, late: 9, absent: 10 },
        ]
    },
    { 
        week: "Sem 2", 
        rate: 84,
        dailyData: [
            { day: "Lun", present: 98, late: 10, absent: 17 },
            { day: "Mar", present: 102, late: 8, absent: 15 },
            { day: "Mié", present: 100, late: 12, absent: 13 },
            { day: "Jue", present: 96, late: 14, absent: 15 },
            { day: "Vie", present: 99, late: 11, absent: 15 },
        ]
    },
    { 
        week: "Sem 3", 
        rate: 91,
        dailyData: [
            { day: "Lun", present: 112, late: 6, absent: 7 },
            { day: "Mar", present: 115, late: 5, absent: 5 },
            { day: "Mié", present: 118, late: 4, absent: 3 },
            { day: "Jue", present: 110, late: 8, absent: 7 },
            { day: "Vie", present: 114, late: 6, absent: 5 },
        ]
    },
    { 
        week: "Sem 4", 
        rate: 79,
        dailyData: [
            { day: "Lun", present: 90, late: 12, absent: 23 },
            { day: "Mar", present: 88, late: 15, absent: 22 },
            { day: "Mié", present: 92, late: 10, absent: 23 },
            { day: "Jue", present: 85, late: 18, absent: 22 },
            { day: "Vie", present: 87, late: 16, absent: 22 },
        ]
    },
    { 
        week: "Sem 5", 
        rate: 87,
        dailyData: [
            { day: "Lun", present: 104, late: 9, absent: 12 },
            { day: "Mar", present: 108, late: 7, absent: 10 },
            { day: "Mié", present: 106, late: 11, absent: 8 },
            { day: "Jue", present: 101, late: 13, absent: 11 },
            { day: "Vie", present: 105, late: 10, absent: 10 },
        ]
    },
    { 
        week: "Sem 6", 
        rate: 93,
        dailyData: [
            { day: "Lun", present: 118, late: 4, absent: 3 },
            { day: "Mar", present: 120, late: 3, absent: 2 },
            { day: "Mié", present: 122, late: 2, absent: 1 },
            { day: "Jue", present: 115, late: 6, absent: 4 },
            { day: "Vie", present: 119, late: 4, absent: 2 },
        ]
    },
    { 
        week: "Sem 7", 
        rate: 89,
        dailyData: [
            { day: "Lun", present: 107, late: 8, absent: 10 },
            { day: "Mar", present: 111, late: 6, absent: 8 },
            { day: "Mié", present: 109, late: 9, absent: 7 },
            { day: "Jue", present: 103, late: 11, absent: 11 },
            { day: "Vie", present: 108, late: 8, absent: 9 },
        ]
    },
    { 
        week: "Sem 8", 
        rate: 86,
        dailyData: [
            { day: "Lun", present: 103, late: 9, absent: 13 },
            { day: "Mar", present: 106, late: 7, absent: 12 },
            { day: "Mié", present: 104, late: 10, absent: 11 },
            { day: "Jue", present: 99, late: 13, absent: 13 },
            { day: "Vie", present: 102, late: 11, absent: 12 },
        ]
    },
];

export const mockCourseAttendance = [
    { course: "POO-301", rate: 93 },
    { course: "FIS-101", rate: 91 },
    { course: "AED-401", rate: 87 },
    { course: "BD-401", rate: 82 },
    { course: "MAT-201", rate: 79 },
];

export const mockRecentActivity = [
    { id: "1", student: "María García", course: "AED-401", time: "Hace 3 min", status: "on_time" },
    { id: "2", student: "Carlos Rodríguez", course: "AED-401", time: "Hace 5 min", status: "late" },
    { id: "3", student: "Luis Herrera", course: "MAT-201", time: "Hace 10 min", status: "absent" },
    { id: "4", student: "Valentina Cruz", course: "POO-301", time: "Hace 12 min", status: "on_time" },
    { id: "5", student: "Ana Martínez", course: "MAT-201", time: "Hace 15 min", status: "on_time" },
];

// ── Instructor Attendance (Mock Data) ────────────────────────

export const mockInstructorAttendance = [
    {
        id: "ia1",
        instructorId: "au1",
        instructorName: "Dr. Felipe Torres",
        department: "Ingeniería de Sistemas",
        totalClasses: 45,
        attendedClasses: 43,
        attendanceRate: 95.6,
        lateClasses: 2,
        missedClasses: 2,
        status: "excellent", // excellent, good, warning, danger
    },
    {
        id: "ia2",
        instructorId: "au2",
        instructorName: "Dra. Patricia Soto",
        department: "Matemáticas",
        totalClasses: 40,
        attendedClasses: 40,
        attendanceRate: 100,
        lateClasses: 0,
        missedClasses: 0,
        status: "excellent",
    },
    {
        id: "ia3",
        instructorId: "au3",
        instructorName: "Dr. Mauricio Reyes",
        department: "Física",
        totalClasses: 38,
        attendedClasses: 35,
        attendanceRate: 92.1,
        lateClasses: 1,
        missedClasses: 3,
        status: "good",
    },
    {
        id: "ia4",
        instructorId: "au4",
        instructorName: "Ing. Sandra Varela",
        department: "Programación",
        totalClasses: 42,
        attendedClasses: 38,
        attendanceRate: 90.5,
        lateClasses: 3,
        missedClasses: 4,
        status: "good",
    },
    {
        id: "ia5",
        instructorId: "au5",
        instructorName: "Dr. Hugo Méndez",
        department: "Bases de Datos",
        totalClasses: 36,
        attendedClasses: 34,
        attendanceRate: 94.4,
        lateClasses: 1,
        missedClasses: 2,
        status: "excellent",
    },
];

// ── Fichas/Grupos (Mock Data) ────────────────────────────────

export const mockFichas = [
    {
        id: "f1",
        code: "2240001",
        name: "Tecnología en Análisis y Desarrollo de Software",
        program: "ADSO",
        instructor: "Dr. Felipe Torres",
        instructorId: "au1",
        totalStudents: 35,
        activeStudents: 33,
        avgAttendance: 93.2,
        presentToday: 31,
        lateToday: 2,
        absentToday: 2,
        atRiskStudents: 1,
        excellentStudents: 28,
        color: "#4F6BED",
    },
    {
        id: "f2",
        code: "2240002",
        name: "Tecnología en Gestión de Redes",
        program: "Redes",
        instructor: "Dra. Patricia Soto",
        instructorId: "au2",
        totalStudents: 30,
        activeStudents: 29,
        avgAttendance: 95.8,
        presentToday: 28,
        lateToday: 1,
        absentToday: 1,
        atRiskStudents: 0,
        excellentStudents: 27,
        color: "#10B981",
    },
    {
        id: "f3",
        code: "2240003",
        name: "Tecnología en Electrónica",
        program: "Electrónica",
        instructor: "Dr. Mauricio Reyes",
        instructorId: "au3",
        totalStudents: 28,
        activeStudents: 26,
        avgAttendance: 78.5,
        presentToday: 20,
        lateToday: 4,
        absentToday: 4,
        atRiskStudents: 5,
        excellentStudents: 15,
        color: "#F59E0B",
    },
    {
        id: "f4",
        code: "2240004",
        name: "Tecnología en Programación de Software",
        program: "Programación",
        instructor: "Ing. Sandra Varela",
        instructorId: "au4",
        totalStudents: 32,
        activeStudents: 30,
        avgAttendance: 87.3,
        presentToday: 27,
        lateToday: 2,
        absentToday: 3,
        atRiskStudents: 2,
        excellentStudents: 22,
        color: "#8B5CF6",
    },
    {
        id: "f5",
        code: "2240005",
        name: "Tecnología en Bases de Datos",
        program: "Bases de Datos",
        instructor: "Dr. Hugo Méndez",
        instructorId: "au5",
        totalStudents: 25,
        activeStudents: 24,
        avgAttendance: 91.2,
        presentToday: 23,
        lateToday: 1,
        absentToday: 1,
        atRiskStudents: 1,
        excellentStudents: 20,
        color: "#EF4444",
    },
    {
        id: "f6",
        code: "2240006",
        name: "Tecnología en Diseño Gráfico",
        program: "Diseño",
        instructor: "Prof. Fernando Castro",
        instructorId: "au6",
        totalStudents: 22,
        activeStudents: 20,
        avgAttendance: 72.8,
        presentToday: 15,
        lateToday: 3,
        absentToday: 4,
        atRiskStudents: 6,
        excellentStudents: 10,
        color: "#06B6D4",
    },
];

// ── Estudiantes en Riesgo (Mock Data) ────────────────────────

export const mockAtRiskStudents = [
    {
        id: "ars1",
        studentId: "5",
        name: "Sofia Pérez Muñoz",
        code: "POO-301001",
        ficha: "2240003",
        fichaName: "Electrónica",
        attendanceRate: 60,
        totalAbsences: 18,
        consecutiveAbsences: 3,
        lateCount: 5,
        riskLevel: "high", // high, medium, low
        daysUntilSanction: 5,
        lastAttendance: "Hace 3 días",
    },
    {
        id: "ars2",
        studentId: "9",
        name: "Andrea Morales Cruz",
        code: "PD-101002",
        ficha: "2240006",
        fichaName: "Diseño Gráfico",
        attendanceRate: 68,
        totalAbsences: 15,
        consecutiveAbsences: 2,
        lateCount: 7,
        riskLevel: "high",
        daysUntilSanction: 8,
        lastAttendance: "Hace 2 días",
    },
    {
        id: "ars3",
        studentId: "10",
        name: "Roberto Silva Gómez",
        code: "FIS-101002",
        ficha: "2240003",
        fichaName: "Electrónica",
        attendanceRate: 73,
        totalAbsences: 13,
        consecutiveAbsences: 1,
        lateCount: 4,
        riskLevel: "medium",
        daysUntilSanction: 10,
        lastAttendance: "Hoy",
    },
    {
        id: "ars4",
        studentId: "4",
        name: "Luis Herrera Díaz",
        code: "FIS-101001",
        ficha: "2240004",
        fichaName: "Programación",
        attendanceRate: 75,
        totalAbsences: 12,
        consecutiveAbsences: 0,
        lateCount: 8,
        riskLevel: "medium",
        daysUntilSanction: 12,
        lastAttendance: "Hoy",
    },
    {
        id: "ars5",
        studentId: "8",
        name: "Daniel Ramírez Pinto",
        code: "PD-101001",
        ficha: "2240006",
        fichaName: "Diseño Gráfico",
        attendanceRate: 78,
        totalAbsences: 10,
        consecutiveAbsences: 1,
        lateCount: 6,
        riskLevel: "medium",
        daysUntilSanction: 15,
        lastAttendance: "Ayer",
    },
];

// ── Estudiantes con Asistencia Perfecta (Mock Data) ──────────

export const mockPerfectAttendanceStudents = [
    {
        id: "pas1",
        studentId: "3",
        name: "Ana Martínez Ríos",
        code: "MAT-201001",
        ficha: "2240002",
        fichaName: "Gestión de Redes",
        attendanceRate: 95,
        totalClasses: 45,
        consecutivePerfect: 45,
        streak: "45 días",
    },
    {
        id: "pas2",
        studentId: "11",
        name: "Camila Ruiz Torres",
        code: "MAT-201002",
        ficha: "2240002",
        fichaName: "Gestión de Redes",
        attendanceRate: 97.5,
        totalClasses: 40,
        consecutivePerfect: 38,
        streak: "38 días",
    },
    {
        id: "pas3",
        studentId: "12",
        name: "Santiago Ospina León",
        code: "BD-401002",
        ficha: "2240005",
        fichaName: "Bases de Datos",
        attendanceRate: 96.7,
        totalClasses: 36,
        consecutivePerfect: 35,
        streak: "35 días",
    },
    {
        id: "pas4",
        studentId: "1",
        name: "María García López",
        code: "AED-401001",
        ficha: "2240001",
        fichaName: "ADSO",
        attendanceRate: 92,
        totalClasses: 45,
        consecutivePerfect: 42,
        streak: "42 días",
    },
    {
        id: "pas5",
        studentId: "7",
        name: "Valentina Cruz Lozano",
        code: "AED-401003",
        ficha: "2240001",
        fichaName: "ADSO",
        attendanceRate: 91,
        totalClasses: 45,
        consecutivePerfect: 40,
        streak: "40 días",
    },
];

export const mockUser = {
    id: "u1",
    name: "Prof. Fernando Castro",
    email: "f.castro@uni.edu",
    role: "teacher",
};

// ── AppUsers mock ────────────────────────────────────────────

export const mockAppUsers = [
    {
        id: "au1",
        name: "Dr. Felipe Torres",
        email: "f.torres@uni.edu",
        role: "teacher",
        code: "DOC001",
        department: "Ingeniería de Sistemas",
        status: "active",
    },
    {
        id: "au2",
        name: "Dra. Patricia Soto",
        email: "p.soto@uni.edu",
        role: "teacher",
        code: "DOC002",
        department: "Matemáticas",
        status: "active",
    },
    {
        id: "au3",
        name: "Dr. Mauricio Reyes",
        email: "m.reyes@uni.edu",
        role: "teacher",
        code: "DOC003",
        department: "Física",
        status: "active",
    },
    {
        id: "au4",
        name: "Ing. Sandra Varela",
        email: "s.varela@uni.edu",
        role: "teacher",
        code: "DOC004",
        department: "Programación",
        status: "active",
    },
    {
        id: "au5",
        name: "Dr. Hugo Méndez",
        email: "h.mendez@uni.edu",
        role: "teacher",
        code: "DOC005",
        department: "Bases de Datos",
        status: "active",
    },
    {
        id: "au6",
        name: "Prof. Fernando Castro",
        email: "f.castro@uni.edu",
        role: "teacher",
        code: "DOC006",
        department: "Administración",
        status: "active",
    },
    {
        id: "au7",
        name: "Admin. General",
        email: "admin@uni.edu",
        role: "admin",
        code: "ADM001",
        status: "active",
    },
    {
        id: "au8",
        name: "María García López",
        email: "m.garcia@uni.edu",
        role: "student",
        code: "AED-401001",
        status: "active",
    },
    {
        id: "au9",
        name: "Carlos Rodríguez",
        email: "c.rodriguez@uni.edu",
        role: "student",
        code: "AED-401002",
        status: "inactive",
    },
];

// ── Environments mock ────────────────────────────────────────

export const mockEnvironments = [
    {
        id: "env1",
        number: "301",
        description:
            "Bloque A, piso 3 — Aula de teoría con capacidad para 40 estudiantes. Dotada de videobeam y aire acondicionado.",
        capacity: 40,
        schedules: [
            {
                id: "sch1",
                courseCode: "AED-401",
                courseName: "Algoritmos y Estructuras de Datos",
                instructor: "au1",
                instructorName: "Dr. Felipe Torres",
                startTime: "08:00",
                endTime: "10:00",
                days: ["Lun", "Mié"],
            },
            {
                id: "sch2",
                courseCode: "BD-401",
                courseName: "Bases de Datos",
                instructor: "au5",
                instructorName: "Dr. Hugo Méndez",
                startTime: "14:00",
                endTime: "18:00",
                days: ["Vie"],
            },
        ],
    },
    {
        id: "env2",
        number: "105",
        description: "Bloque B, piso 1 — Aula de matemáticas con tablero de vidrio y sistema de audio.",
        capacity: 35,
        schedules: [
            {
                id: "sch3",
                courseCode: "MAT-201",
                courseName: "Cálculo Diferencial",
                instructor: "au2",
                instructorName: "Dra. Patricia Soto",
                startTime: "10:00",
                endTime: "12:00",
                days: ["Mar", "Jue"],
            },
        ],
    },
    {
        id: "env3",
        number: "Lab. Física",
        description: "Bloque C, piso 1 — Laboratorio de física con equipos de medición. Requiere bata de laboratorio.",
        capacity: 20,
        schedules: [
            {
                id: "sch4",
                courseCode: "FIS-101",
                courseName: "Física I",
                instructor: "au3",
                instructorName: "Dr. Mauricio Reyes",
                startTime: "07:00",
                endTime: "08:00",
                days: ["Lun", "Mié", "Vie"],
            },
        ],
    },
    {
        id: "env4",
        number: "Lab. Computación",
        description: "Bloque A, piso 2 — Laboratorio de cómputo con 30 equipos. Acceso con carné estudiantil.",
        capacity: 30,
        schedules: [
            {
                id: "sch5",
                courseCode: "POO-301",
                courseName: "Programación Orientada a Objetos",
                instructor: "au4",
                instructorName: "Ing. Sandra Varela",
                startTime: "14:00",
                endTime: "16:00",
                days: ["Mar", "Jue"],
            },
        ],
    },
    {
        id: "env5",
        number: "209-3",
        description: "Salón número 3 de adso",
        capacity: 25,
        schedules: [],
    },
];
