// ============================================================
//  FaceAttend EDU — useRolePermissions
//
//  Hook centralizado de permisos por rol.
//  ÚNICA fuente de verdad sobre qué puede hacer cada rol.
//
//  Uso:
//    const { canManageStudents, visibleTabs } = useRolePermissions();
//    {canManageStudents && <UIButton>+ Nuevo</UIButton>}
//
//  Roles:
//    admin   → acceso total; el rol explícito "Super Administrador"
//              (o sin sede propia) es "Super Admin", el resto es
//              "Admin de sede"
//    teacher → acceso parcial (sus cursos, sin gestión de usuarios/ambientes)
//    student → acceso mínimo (solo su perfil y sus cursos)
// ============================================================

import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { hasSuperAdminRole } from "../core/utils/backendRoles";

// ── Permisos por rol ────────────────────────────────────────

// ── Labels de tabs por rol ───────────────────────────────────
// Cada rol puede tener una interpretación diferente del mismo tab

const TAB_LABELS_BY_ROLE = {
    admin: {
        users: "Usuarios",
    },
    teacher: {
        users: "Alumnos",
        courses: "Mis cursos",
    },
    student: {
        courses: "Mis cursos",
    },
};

function getTabLabel(tabKey, role) {
    return TAB_LABELS_BY_ROLE[role]?.[tabKey] || null;
}

// ── Cálculo de tabs visibles ────────────────────────────────

function getVisibleTabs(role, isSuperAdmin) {
    switch (role) {
        case "admin":
            if (isSuperAdmin) {
                // Super Admin global: multi-sede (escuelas, reportes por
                // sede, usuarios, historial). Sin expedientes propios de
                // instituciones (justificaciones) ni detalle académico
                // (cursos, ambientes, académico).
                return [
                    "dashboard",
                    "schools",
                    "reports",
                    "users",
                    "roles",
                    "history",
                    "alerts",
                    "settings",
                ];
            }
            // Admin de sede: gestión de su sede. Historial y
            // Justificaciones con alcance de sede (HU-HIST-001
            // AC12, HU-JUS-002 AC1). Sin tab "schools".
            return [
                "dashboard",
                "reports",
                "users",
                "courses",
                "academic",
                "environments",
                "history",
                "justifications",
                "alerts",
                "settings",
            ];
        case "teacher":
            // Docente: sus fichas. Ambientes en lectura (ver dónde
            // enseña, sin gestionar). Sin "Académico" (redundante
            // con "Mis cursos" y Reportes).
            return [
                "dashboard",
                "users",
                "courses",
                "environments",
                "reports",
                "history",
                "justifications",
                "alerts",
                "settings",
            ];
        case "student":
            // Sin "users" (Compañeros): el estudiante no necesita consultar
            // a sus compañeros. "Sede" (con instructores) vive en Configuración.
            return [
                "dashboard",
                "history",
                "justifications",
                "academic",
                "courses",
                "alerts",
                "settings",
            ];
        default:
            return []; //Vacio aproposito, no queremos fugas aunque alguien logre pasar las validaciones
    }
}

// ── Cálculo de permisos ──────────────────────────────────────

function buildPermissions(role, schoolId = null, roleNames = []) {
    const isAdmin = role === "admin";
    const isTeacher = role === "teacher";
    const isStudent = role === "student";
    // La distinción es explícita en la DB: el rol "Super Administrador"
    // (007-split-super-admin-role) marca al administrador global. El
    // fallback por sede cubre cuentas con roles no reconocidos en la
    // respuesta del backend.
    const isSuperAdmin = isAdmin && (hasSuperAdminRole(roleNames) || schoolId == null);

    return {
        // Estudiantes (HU-IAM-002/007/008/010)
        canViewStudents: isAdmin || isTeacher,
        canManageStudents: isAdmin,
        canCreateUser: isAdmin,
        canEditUser: isAdmin,
        canToggleUserStatus: isAdmin,
        // Eliminar es lógico (desactivar, HU-IAM-008) con alcance de sede:
        // el admin solo ve usuarios de su sede (scopedUsers) y el super
        // puede con cualquiera. Sin super-bootstrap operativo no habría
        // quién elimine: por eso NO se restringe al super.
        canDeleteUser: isAdmin,
        canChangeUserRole: isSuperAdmin,
        canImportStudents: isAdmin,
        // Biométrico (HU-ATT-002). canRegisterFace se conserva como alias
        // de inscripción a terceros para no romper imports existentes.
        canRegisterFace: isAdmin || isTeacher,
        canEnrollOwnFace: true,
        canEnrollOthersFace: isAdmin || isTeacher,
        canDeleteBiometrics: isAdmin,

        // Cursos (HU-SCH-001, FR 8.1)
        canViewCourses: true,
        canManageCourses: isAdmin,
        canDeleteCourse: isSuperAdmin,

        // Ambientes (HU-ACAD-001)
        canViewEnvironments: isAdmin || isTeacher,
        canManageEnvironments: isAdmin,

        // Académico (HU-ACAD-002/004/005)
        canManageAcademic: isAdmin,

        // Sesiones de clase (scheduling.session:manage). El kiosco
        // abrir/cerrar/cancelar usa este permiso, no canRegisterFace.
        canManageSessions: isAdmin || isTeacher,
        // Corrección de asistencia (attendance.record:write)
        canCorrectAttendance: isAdmin || isTeacher,
        // Casos biométricos SQL (biometric.case:request/review)
        canRequestBiometricUpdate: true,
        canReviewBiometricUpdate: isAdmin,

        // Reportes (HU-REP-001/002/003/004)
        canViewReports: isAdmin || isTeacher,
        canViewOwnReports: isStudent,
        canExportReports: isAdmin || isTeacher,
        canNotifyAll: isAdmin,
        canViewAllReports: isAdmin,
        canReviewAllScopes: isSuperAdmin,

        // Historial de asistencia (HU-HIST-001: consulta los 3 roles, AC10/AC11/AC12)
        canViewHistory: true,

        // Justificaciones (HU-JUS-001 alumno · HU-JUS-002 instructor/admin)
        // Nota: la matriz de acceso marca Instructor ✅ también para enviar, pero las
        // reglas de navegación y el mapa de pantallas dicen "solo alumnos".
        canSubmitJustifications: isStudent,
        canReviewJustifications: isAdmin || isTeacher,

        // Información de la sede (lectura los 3 roles, edición solo admin)
        canViewSchoolInfo: true,
        canEditSchoolInfo: isAdmin,

        // Gestión de escuelas (CRUD de sedes): solo el super admin
        canManageSchools: isSuperAdmin,

        // Sección académica y contactos (solo lectura, los 3 roles)
        canViewAcademic: true,
        canViewContacts: true,

        // Configuración (configuration:manage + HU-CONF-001..008)
        // Granular por sección: Teacher/StudentSettings solo deben usar
        // notificaciones y apariencia (ver AdminSettings vs sidebar adminOnly).
        canManageConfiguration: isAdmin,
        canManageGeneralSettings: isAdmin,
        canManageFacialConfig: isAdmin,
        canManageSecurityConfig: isAdmin,
        canManageNotifications: true,
        canManageJustificationTypes: isAdmin,
        // Alertas (notification.alert:read, HU-JUS-003)
        canViewAlerts: true,
        canManageAlerts: isAdmin,
        // RBAC admin (HU-IAM-003, FR 1.1.2): matriz rol x permiso
        canManageRoles: isSuperAdmin,

        // Compat: aliases históricos usados por Views existentes.
        canEditAppearance: true,
        canManageUsers: isAdmin,
        canViewSettings: true,

        // Navegación
        visibleTabs: getVisibleTabs(role, isSuperAdmin),
        getTabLabel: (tabKey) => getTabLabel(tabKey, role),

        // Metadatos
        role,
        isAdmin,
        isSuperAdmin,
        isTeacher,
        isStudent,
    };
}

// ── Permisos de invitado (sin sesión) ────────────────────────
// Fail-secure (security-policy.md): sin sesión, cero permisos.

const GUEST_PERMISSIONS = {
    canViewStudents: false,
    canManageStudents: false,
    canCreateUser: false,
    canEditUser: false,
    canToggleUserStatus: false,
    canDeleteUser: false,
    canChangeUserRole: false,
    canImportStudents: false,
    canRegisterFace: false,
    canEnrollOwnFace: false,
    canEnrollOthersFace: false,
    canDeleteBiometrics: false,
    canViewCourses: false,
    canManageCourses: false,
    canDeleteCourse: false,
    canViewEnvironments: false,
    canManageEnvironments: false,
    canManageAcademic: false,
    canManageSessions: false,
    canCorrectAttendance: false,
    canRequestBiometricUpdate: false,
    canReviewBiometricUpdate: false,
    canViewReports: false,
    canViewOwnReports: false,
    canExportReports: false,
    canNotifyAll: false,
    canViewAllReports: false,
    canReviewAllScopes: false,
    canViewHistory: false,
    canSubmitJustifications: false,
    canReviewJustifications: false,
    canViewSchoolInfo: false,
    canEditSchoolInfo: false,
    canManageSchools: false,
    canViewAcademic: false,
    canViewContacts: false,
    canManageConfiguration: false,
    canManageGeneralSettings: false,
    canManageFacialConfig: false,
    canManageSecurityConfig: false,
    canManageNotifications: false,
    canManageJustificationTypes: false,
    canViewAlerts: false,
    canManageAlerts: false,
    canManageRoles: false,
    canEditAppearance: false,
    canManageUsers: false,
    canViewSettings: false,
    visibleTabs: [],
    getTabLabel: () => null,
    role: null,
    isAdmin: false,
    isSuperAdmin: false,
    isTeacher: false,
    isStudent: false,
};

// ── Hook ──────────────────────────────────────────────────────

export function useRolePermissions() {
    const { user } = useAuth();

    return useMemo(
        () =>
            user
                ? buildPermissions(user.role, user.schoolId ?? null, user.roles ?? [])
                : GUEST_PERMISSIONS,
        [user]
    );
}
