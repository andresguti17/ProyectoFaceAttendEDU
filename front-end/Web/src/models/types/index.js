// ============================================================
//  FaceAttend EDU — Domain Types (Model Layer)
//  Constantes y validadores para las entidades de negocio.
//  Las Views y ViewModels importan desde aquí.
// ============================================================

// ── Roles y estados ────────────────────────────────────────

export const USER_ROLES = {
    ADMIN: "admin",
    TEACHER: "teacher",
    STUDENT: "student"
};

export const APP_USER_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive"
};

export const STUDENT_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive"
};

export const ATTENDANCE_STATUS = {
    ON_TIME: "on_time",
    LATE: "late",
    ABSENT: "absent"
};

export const PERIODS = {
    WEEK: "week",
    MONTH: "month",
    SEMESTER: "semester"
};

// ── Validadores ────────────────────────────────────────────

export function isValidUserRole(role) {
    return Object.values(USER_ROLES).includes(role);
}

export function isValidAttendanceStatus(status) {
    return Object.values(ATTENDANCE_STATUS).includes(status);
}

export function isValidPeriod(period) {
    return Object.values(PERIODS).includes(period);
}
