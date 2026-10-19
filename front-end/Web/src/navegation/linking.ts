// ============================================================
//  FaceAttend EDU — Deep linking (web + móvil)
//
//  Hace el enrutado funcional en web: /, /login, /register,
//  /app/*. React Navigation lo usa vía NavigationContainer.
//  En Docker/nginx el fallback SPA (try_files) redirige aquí.
//
//  NOTA: Este archivo se mantiene para compatibilidad, pero
//  la configuración principal está en linking.config.js
// ============================================================

export const RouteNames = {
    landing: "FaceAttendEDU",
    login: "FaceAttendEDU-Login", 
    register: "FaceAttendEDU-Register",
    dashboard: "Dashboard",
    users: "Users",
    courses: "Courses",
    environments: "Environments",
    reports: "Reports",
    settings: "Settings",
} as const;

export const linking = {
    prefixes: ["http://localhost:3000", "http://localhost:8090", "http://localhost"],
    config: {
        screens: {
            [RouteNames.landing]: "",
            [RouteNames.login]: "login",
            [RouteNames.register]: "register",
            [RouteNames.dashboard]: "app",
            [RouteNames.users]: "app/users",
            [RouteNames.courses]: "app/courses",
            [RouteNames.environments]: "app/environments",
            [RouteNames.reports]: "app/reports",
            [RouteNames.settings]: "app/settings",
        },
    },
};
