// ============================================================
//  FaceAttend EDU — Constantes de opciones de formularios
//  Opciones reutilizables para dropdowns y selectores en toda la app.
//  Centraliza las opciones para facilitar mantenimiento y i18n.
// ============================================================

/**
 * Opciones de jornada para cursos y clases
 * Usadas en: RegisterCourseModal, ScheduleModal, etc.
 */
export const JORNADA_ITEMS = [
    { value: "mañana", label: "Mañana", icon: "sunrise" },
    { value: "tarde", label: "Tarde", icon: "sun" },
    { value: "noche", label: "Noche", icon: "moon" },
    { value: "mixta", label: "Mixta", icon: "clock" },
];

/**
 * Opciones de estado para entidades (cursos, estudiantes, etc.)
 * Usadas en: RegisterCourseModal, RegisterStudentModal, etc.
 */
export const STATUS_ITEMS = [
    { value: "active", label: "Activo", icon: "check-circle" },
    { value: "inactive", label: "Inactivo", icon: "x-circle" },
    { value: "completed", label: "Finalizado", icon: "archive" },
];

/**
 * Opciones de rol para usuarios
 * Usadas en: RegisterStudentModal, AdminUsers, etc.
 */
export const ROLE_ITEMS = [
    { value: "admin", label: "Administrador", description: "Admin", icon: "shield" },
    { value: "teacher", label: "Docente", description: "Teacher", icon: "book-open" },
    { value: "student", label: "Estudiante", description: "Student", icon: "user" },
];

/**
 * Mock de aulas disponibles
 * TODO: En producción, esto debe venir de AppDataContext.environments
 * y ser dinámico según la configuración del centro educativo.
 */
export const AULA_ITEMS = [
    { value: "A-101", label: "A-101", icon: "map-pin" },
    { value: "A-102", label: "A-102", icon: "map-pin" },
    { value: "A-201", label: "A-201", icon: "map-pin" },
    { value: "A-202", label: "A-202", icon: "map-pin" },
    { value: "B-101", label: "B-101", icon: "map-pin" },
    { value: "B-102", label: "B-102", icon: "map-pin" },
    { value: "B-201", label: "B-201", icon: "map-pin" },
    { value: "B-202", label: "B-202", icon: "map-pin" },
    { value: "C-101", label: "C-101", icon: "map-pin" },
    { value: "C-201", label: "C-201", icon: "map-pin" },
];

/**
 * Opciones de tipo de asistencia
 * Usadas en: AttendanceModal, AttendanceList, etc.
 */
export const ATTENDANCE_TYPE_ITEMS = [
    { value: "present", label: "Presente", icon: "check-circle", color: "success" },
    { value: "absent", label: "Ausente", icon: "x-circle", color: "error" },
    { value: "late", label: "Tardanza", icon: "clock", color: "warning" },
    { value: "excused", label: "Excusado", icon: "file-text", color: "info" },
];

/**
 * Opciones de periodo académico
 * Usadas en: Filtros de reportes, selección de periodo, etc.
 */
export const ACADEMIC_PERIOD_ITEMS = [
    { value: "2024-1", label: "2024 - Semestre 1", icon: "calendar" },
    { value: "2024-2", label: "2024 - Semestre 2", icon: "calendar" },
    { value: "2025-1", label: "2025 - Semestre 1", icon: "calendar" },
];

/**
 * Opciones de días de la semana
 * Usadas en: ScheduleModal, horarios de clases, etc.
 */
export const WEEKDAY_ITEMS = [
    { value: "monday", label: "Lunes", short: "L", icon: "calendar" },
    { value: "tuesday", label: "Martes", short: "M", icon: "calendar" },
    { value: "wednesday", label: "Miércoles", short: "X", icon: "calendar" },
    { value: "thursday", label: "Jueves", short: "J", icon: "calendar" },
    { value: "friday", label: "Viernes", short: "V", icon: "calendar" },
    { value: "saturday", label: "Sábado", short: "S", icon: "calendar" },
    { value: "sunday", label: "Domingo", short: "D", icon: "calendar" },
];

/**
 * Opciones de formato de exportación
 * Usadas en: Modales de exportación, reportes, etc.
 */
export const EXPORT_FORMAT_ITEMS = [
    { value: "csv", label: "CSV", description: "Valores separados por coma", icon: "file-text" },
    { value: "excel", label: "Excel", description: "Hoja de cálculo", icon: "file" },
    { value: "pdf", label: "PDF", description: "Documento portable", icon: "file-text" },
    { value: "json", label: "JSON", description: "Formato de datos", icon: "code" },
];
