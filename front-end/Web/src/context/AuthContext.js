// ============================================================
//  FaceAttend EDU — AuthContext
//
//  Fuente de verdad para el usuario autenticado.
//  Expone user, login(), logout(), isAuthenticated.
//  Incluye gestión automática de timeout de sesión.
//
//  login() abre la sesión real contra ms-identity (POST /auth/login),
//  guarda el token en localStorage con la forma compartida con Mobile
//  { token, savedAt, expiresAt, email } y carga roles + perfil.
//
//  Uso:
//    const { user, login, logout, sessionTimeout } = useAuth();
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { getInstitutionConfig } from "../core/config/institutionConfig";
import { useSessionTimeout } from "../core/hooks/useSessionTimeout";
import { clearToken, getToken, saveToken, setUnauthorizedHandler } from "../api/apiClient";
import { roleNamesFrom, toUiRole } from "../core/utils/backendRoles";
import { authApi } from "../services/api/authApi";

// ── Roles del backend → roles de la UI ────────────────────────
// Mapa compartido con UserStorage en core/utils/backendRoles.js.

function loginErrorMessage(err) {
    if (err?.status === 400 || err?.status === 401) return "Credenciales incorrectas";
    if (err?.status === 0) return err.message; // red / timeout
    return err?.message || "No se pudo iniciar sesión";
}
// ── Storage helper (multi-plataforma) ─────────────────────

const SESSION_KEY = "@faceattend:session_user";
const SESSION_TIMEOUT_FLAG_KEY = "@faceattend:session_timeout_flag";
const INTENDED_ROUTE_KEY = "@faceattend:intended_route";

async function sessionGet() {
    if (Platform.OS === "web") {
        try {
            return localStorage.getItem(SESSION_KEY);
        } catch {
            return null;
        }
    }
    const AS = (await import("@react-native-async-storage/async-storage")).default;
    return AS.getItem(SESSION_KEY);
}

async function sessionSet(value) {
    if (Platform.OS === "web") {
        try {
            localStorage.setItem(SESSION_KEY, value);
        } catch {
            /* silent */
        }
        return;
    }
    const AS = (await import("@react-native-async-storage/async-storage")).default;
    await AS.setItem(SESSION_KEY, value);
}

async function sessionRemove() {
    if (Platform.OS === "web") {
        try {
            localStorage.removeItem(SESSION_KEY);
        } catch {
            /* silent */
        }
        return;
    }
    const AS = (await import("@react-native-async-storage/async-storage")).default;
    await AS.removeItem(SESSION_KEY);
}

// Funciones para manejar el flag de timeout
async function getTimeoutFlag() {
    try {
        if (Platform.OS === "web") {
            return localStorage.getItem(SESSION_TIMEOUT_FLAG_KEY) === "true";
        }
        const AS = (await import("@react-native-async-storage/async-storage")).default;
        const flag = await AS.getItem(SESSION_TIMEOUT_FLAG_KEY);
        return flag === "true";
    } catch (error) {
        console.error('[AuthContext] Error reading timeout flag:', error);
        return false;
    }
}

async function setTimeoutFlag(value) {
    try {
        if (Platform.OS === "web") {
            localStorage.setItem(SESSION_TIMEOUT_FLAG_KEY, value ? "true" : "false");
            return;
        }
        const AS = (await import("@react-native-async-storage/async-storage")).default;
        await AS.setItem(SESSION_TIMEOUT_FLAG_KEY, value ? "true" : "false");
    } catch (error) {
        console.error('[AuthContext] Error setting timeout flag:', error);
    }
}

async function removeTimeoutFlag() {
    try {
        if (Platform.OS === "web") {
            localStorage.removeItem(SESSION_TIMEOUT_FLAG_KEY);
            return;
        }
        const AS = (await import("@react-native-async-storage/async-storage")).default;
        await AS.removeItem(SESSION_TIMEOUT_FLAG_KEY);
    } catch (error) {
        console.error('[AuthContext] Error removing timeout flag:', error);
    }
}

// Funciones para manejar la ruta deseada (intended route)
async function getIntendedRoute() {
    try {
        if (Platform.OS === "web") {
            const route = localStorage.getItem(INTENDED_ROUTE_KEY);
            return route ? JSON.parse(route) : null;
        }
        const AS = (await import("@react-native-async-storage/async-storage")).default;
        const route = await AS.getItem(INTENDED_ROUTE_KEY);
        return route ? JSON.parse(route) : null;
    } catch (error) {
        console.error('[AuthContext] Error reading intended route:', error);
        return null;
    }
}

async function storeIntendedRoute(routeInfo) {
    try {
        if (Platform.OS === "web") {
            localStorage.setItem(INTENDED_ROUTE_KEY, JSON.stringify(routeInfo));
            return;
        }
        const AS = (await import("@react-native-async-storage/async-storage")).default;
        await AS.setItem(INTENDED_ROUTE_KEY, JSON.stringify(routeInfo));
    } catch (error) {
        console.error('[AuthContext] Error storing intended route:', error);
    }
}

async function removeIntendedRoute() {
    try {
        if (Platform.OS === "web") {
            localStorage.removeItem(INTENDED_ROUTE_KEY);
            return;
        }
        const AS = (await import("@react-native-async-storage/async-storage")).default;
        await AS.removeItem(INTENDED_ROUTE_KEY);
    } catch (error) {
        console.error('[AuthContext] Error removing intended route:', error);
    }
}

/**
 * ¿El sessionId sigue vivo en el backend?
 *
 * El token opaco caduca a las 8 h (security_configuration.session_timeout_minutes)
 * aunque localmente no tenga expiresAt, y esa expiración es perezosa: el primer
 * GET de sesión lo marca "Closed" (GetUserSessionUseCaseImpl). La llamada lleva el
 * propio sessionId como bearer, así que Kong (pre-function del edge) la responde con
 * 401 en cuanto la sesión deja de estar Active.
 *
 * Solo se descarta la sesión con una respuesta definitiva (401/404 o estado
 * distinto de Active); si el backend no responde se conserva, para no cerrar
 * la sesión de nadie por un reinicio del contenedor.
 */
async function isSessionAlive(token) {
    try {
        const session = await authApi.getSession(token);
        return session?.sessionStatus === "Active";
    } catch (err) {
        return err?.status !== 401 && err?.status !== 404;
    }
}

// ── Context ───────────────────────────────────────────────

const AuthContext = createContext(null);

// ── Provider ──────────────────────────────────────────────

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [sessionExpiredByTimeout, setSessionExpiredByTimeout] = useState(false);
    const [isLoadingTimeoutFlag, setIsLoadingTimeoutFlag] = useState(true);
    const [intendedRoute, setIntendedRoute] = useState(null); // Ruta deseada
    
    // Estado reactivo de configuración - se actualiza cuando cambie
    const [config, setConfig] = useState(() => getInstitutionConfig());
    
    // Listener para cambios de configuración
    useEffect(() => {
        const handleConfigUpdate = (event) => {
            setConfig(event.detail); // Actualizar config cuando cambie
        };

        // Escuchar evento de actualización de configuración
        window.addEventListener('institutionConfigUpdated', handleConfigUpdate);
        
        return () => {
            window.removeEventListener('institutionConfigUpdated', handleConfigUpdate);
        };
    }, []);

    // Función para guardar la ruta donde ocurrió el error de autorización
    const saveIntendedRoute = useCallback(async (routeInfo) => {
        await storeIntendedRoute(routeInfo);
        setIntendedRoute(routeInfo); // Update React state
    }, []);

    // Función para limpiar la ruta deseada
    const clearIntendedRoute = useCallback(async () => {
        await removeIntendedRoute();
        setIntendedRoute(null);
    }, []);

    // Función para obtener y limpiar la ruta deseada (para usar después del login)
    const consumeIntendedRoute = useCallback(async () => {
        // Leer directamente del storage, no del estado React
        const route = await getIntendedRoute();
        if (route) {
            // Limpiar del storage Y del estado React
            await removeIntendedRoute();
            setIntendedRoute(null);
            return route;
        }
        return null;
    }, []);
    // ============================================================ 
    // SISTEMA DE REDIRECCIÓN SIMPLE - Sin dependencias externas
    // ============================================================
    
    const handleSessionTimeout = useCallback(async () => {
        console.log('[AuthContext] Session timeout triggered');
        
        // Marcar que fue por timeout y limpiar sesión
        await setTimeoutFlag(true); 
        setSessionExpiredByTimeout(true); 
        await sessionRemove(); 
        setUser(null); 
        
        // IMPORTANTE: No limpiar el timer aquí porque el hook ya se encarga
        // El timer se detendrá automáticamente cuando enabled sea false (user === null)
        
        // La ruta ya está guardada desde que el usuario navegó
    }, []);

    // Sistema de timeout de sesión - REACTIVO a cambios de configuración  
    const sessionTimeout = useSessionTimeout({
        timeoutMinutes: config.sessionTime || 60,
        onTimeout: handleSessionTimeout,
        warningMinutes: 2, // 2 minutos de advertencia antes del timeout
        enabled: user !== null // Solo activar si hay usuario logueado
    });

    // COMENTADO: Efecto para reiniciar timer - puede causar problemas de timers residuales
    // useEffect(() => {
    //     if (sessionTimeout && user) {
    //         sessionTimeout.resetTimer(); // Reiniciar con nueva configuración
    //     }
    // }, [config.sessionTime, config.sessionWarningTime]); // SOLO las config values

    // Recuperar sesión guardada al montar: solo es una sesión válida si el
    // token también está presente (y no expiró, getToken ya lo filtra) y si
    // el backend la sigue reconociendo (isSessionAlive).
    useEffect(() => {
        Promise.all([sessionGet(), getToken(), getTimeoutFlag(), getIntendedRoute()]).then(async ([raw, token, timeoutFlag, savedIntendedRoute]) => {
            let saved = null;

            if (timeoutFlag) {
                // Flag de timeout: la sesión expiró por inactividad. No se carga
                // el usuario, pero se conserva la ruta deseada para redirigir.
                setUser(null);
                setSessionExpiredByTimeout(true);
                setIntendedRoute(savedIntendedRoute);
            } else if (raw && token) {
                try {
                    saved = JSON.parse(raw);                } catch {
                    /* sesión corrupta, ignorar */
                    setUser(null);
                    setSessionExpiredByTimeout(false);
                }
                setIntendedRoute(savedIntendedRoute);
            } else if (raw) {
                // Usuario sin token: no hay sesión autenticada que restaurar.
                await sessionRemove();
                setUser(null);
                setSessionExpiredByTimeout(false);
                setIntendedRoute(savedIntendedRoute);
            } else {
                // No hay sesión
                setUser(null);
                setSessionExpiredByTimeout(false);
                setIntendedRoute(savedIntendedRoute);
            }

            if (saved && !(await isSessionAlive(token))) {
                // Sesión ya cerrada/vencida en el backend: purgar y volver a login.
                await clearToken();
                await sessionRemove();
                saved = null;
            }

            if (saved) setUser(saved);

            setIsLoadingAuth(false);
            setIsLoadingTimeoutFlag(false); // Marcar que ya terminamos de cargar
        });
    }, []);

    // Primer 401 con un bearer que el backend ya no acepta: purgar la sesión
    // local. AuthenticatedNavigator deja de montarse y NotAuthorized navega a
    // Login, en vez de quedarse en /app disparando 401 en cada llamada.
    useEffect(() => {
        setUnauthorizedHandler(() => {
            void clearToken();
            void sessionRemove();
            setUser(null);
        });
        return () => setUnauthorizedHandler(null);
    }, []);

    const login = useCallback(async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
            return "Completa todos los campos";
        }

        let session;
        try {
            session = await authApi.login({
                email: credentials.email,
                password: credentials.password,
            });
        } catch (err) {
            return loginErrorMessage(err);
        }

        const sessionId = session?.sessionId ?? session?.session_id ?? session?.id;
        const userId = session?.userId ?? session?.user_id;
        if (!sessionId || !userId) {
            return "No se pudo crear la sesión";
        }

        // El token se guarda antes de las llamadas autenticadas, como en Mobile.
        const saved = await saveToken(String(sessionId), { email: credentials.email });
        if (!saved) return "No se pudo guardar la sesión";

        let roles;
        let userDto;
        try {
            [roles, userDto] = await Promise.all([
                authApi.userRoles(userId),
                authApi.getUser(userId),
            ]);
        } catch (err) {
            await clearToken();
            return err?.message || "No se pudo cargar el perfil";
        }

        const roleNames = roleNamesFrom(roles);
        const role = toUiRole(roleNames);
        if (!role) {
            await clearToken();
            // "cuenta" hace que useAuthViewModel lo muestre en el campo de email.
            // Distingue: sin roles asignados vs. roles que la app no sabe mapear.
            return roleNames.length
                ? `La cuenta tiene un rol no reconocido: ${roleNames.join(", ")}`
                : "La cuenta no tiene roles asignados en el backend";
        }

        const personId = userDto?.personId ?? userDto?.person_id ?? null;
        let person = null;
        if (personId) {
            try {
                person = await authApi.getPerson(personId);
            } catch {
                person = null;
            }
        }

        // Sede del usuario: vive en academic_actor (person es agnostica de sede,
        // MODELO §2.6). Sin esto el admin no tenia con que acotar lo que ve y la
        // aplicacion mostraba las dos instituciones mezcladas.
        const school = personId ? await authApi.schoolOf(personId) : null;

        const sessionUser = {
            id: userId,
            personId,
            schoolId: school?.schoolId ?? null,
            academicActorId: school?.academicActorId ?? null,
            username: userDto?.username ?? credentials.email,
            email: person?.email ?? credentials.email,
            name: person
                ? `${person.name ?? ""} ${person.lastName ?? person.last_name ?? ""}`.trim()
                : credentials.email,
            role,
            roles: roleNames,
            avatar: null,
        };

        // ── Sesión limpia (trabajo propio: timeout + ruta deseada) ──
        // Obtener ruta deseada ANTES de limpiar estados
        const redirectRoute = await consumeIntendedRoute();
        console.log('[AuthContext] Login: redirectRoute obtained:', redirectRoute);

        // LIMPIAR COMPLETAMENTE cualquier estado anterior antes de establecer nueva sesión
        if (sessionTimeout && sessionTimeout.clearTimer) {
            sessionTimeout.clearTimer(); // Detener cualquier timer anterior
        }

        await removeTimeoutFlag(); // Limpiar flag persistente
        await removeIntendedRoute(); // Limpiar ruta deseada del storage
        await sessionRemove(); // Limpiar sesión anterior por seguridad

        // Limpiar estados de React
        setSessionExpiredByTimeout(false);
        setIntendedRoute(null);

        // Establecer nueva sesión limpia
        await sessionSet(JSON.stringify(sessionUser));
        setUser(sessionUser);

        // El timer se reiniciará automáticamente cuando enabled=true (user !== null)

        console.log('[AuthContext] Login successful, returning:', { success: true, redirectRoute });
        return { success: true, redirectRoute };
    }, [consumeIntendedRoute, sessionTimeout]);

    const logout = useCallback(async () => {
        // IMPORTANTE: Detener completamente el timer ANTES de limpiar el resto
        if (sessionTimeout && sessionTimeout.clearTimer) {
            sessionTimeout.clearTimer();
        }

        await removeTimeoutFlag(); // Limpiar flag persistente
        await removeIntendedRoute(); // Limpiar ruta deseada
        setSessionExpiredByTimeout(false); // Limpiar flag de timeout para logout manual
        setIntendedRoute(null);

        // Cerrar la sesión también en el backend (novedad de develop)
        const token = await getToken();
        if (token) {
            await authApi.logout(token).catch(() => null);
        }
        await clearToken();        await sessionRemove();
        setUser(null);
    }, [sessionTimeout]);

    const register = useCallback(async (userData) => {
        // ── Mock: el backend no expone auto-registro de usuarios ──
        await new Promise((res) => setTimeout(res, 900)); // simular latencia de red

        if (!userData.email || !userData.password || !userData.username) {
            return "Completa todos los campos";
        }

        // Crear objeto de usuario registrado (por ahora sin rol, se asignaría en backend)
        const newUser = {
            id: `user_${Date.now()}`, // ID temporal
            username: userData.username,
            email: userData.email,
            firstName: userData.username, // Temporalmente usar username como nombre
            lastName: "",
            role: "student", // Rol por defecto para usuarios registrados
            avatar: null,
        };

        await sessionSet(JSON.stringify(newUser));
        setUser(newUser);
        await removeIntendedRoute(); // Limpiar ruta deseada al registrarse
        await removeTimeoutFlag(); // Limpiar flag persistente al registrarse
        setSessionExpiredByTimeout(false); // Limpiar flag al registrarse
        
        // El timer se iniciará automáticamente cuando enabled=true (user !== null)
        
        return { success: true, redirectRoute: null }; // No hay redirección en registro
    }, [sessionTimeout]);

    const value = useMemo(
        () => ({
            user,
            isLoadingAuth,
            isAuthenticated: user !== null,
            sessionExpiredByTimeout,
            isLoadingTimeoutFlag,
            intendedRoute,
            saveIntendedRoute,
            clearIntendedRoute,
            consumeIntendedRoute,
            login,
            logout,
            register,
            sessionTimeout,
        }),
        [user, isLoadingAuth, sessionExpiredByTimeout, isLoadingTimeoutFlag, intendedRoute, saveIntendedRoute, clearIntendedRoute, consumeIntendedRoute, login, logout, register, sessionTimeout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error(
            "[FaceAttend] useAuth() debe usarse dentro de <AuthProvider>. " +
            "Envuelve tu app con <AuthProvider> en app.tsx."
        );
    }
    return ctx;
}
