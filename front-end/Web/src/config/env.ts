// ============================================================
//  FaceAttend EDU — Configuración central del frontend Web
//
//  Lee la URL del backend desde EXPO_PUBLIC_API_URL (build time
//  en Expo, horneada en el bundle estático). Si no se fijó una
//  URL explícita, se infiere del host con el que se cargó la
//  página (mismo patrón que Mobile en src/config/env.js): abrir
//  http://10.0.0.5:8090 asume Kong en http://10.0.0.5:8000. Así
//  un cambio de IP de LAN no exige reconstruir la imagen Docker.
//
//  Caso especial: VS Code Dev Tunnels (*.devtunnels.ms) no exponen el
//  puerto como "host:puerto" — cada puerto forwardeado tiene su propio
//  subdominio "<id>-<puerto>.<region>.devtunnels.ms", y solo existe si
//  se forwardeó ese puerto explícitamente en el panel de Ports. Pedirle
//  al usuario que forwardee también el puerto de Kong (8000) — con el
//  mismo nivel de visibilidad que 8090, o las peticiones quedan bloqueadas
//  igual — era un error fácil de cometer y la causa real de fallos "no
//  carga nada" bajo devtunnels. Se evita del todo quedándose en el mismo
//  origen (el de la pestaña, el túnel de 8090): nginx ya proxea /api/*
//  hacia kong-gateway:8000 dentro de la red de Docker (ver nginx.conf),
//  así que un solo puerto forwardeado basta.
//
//  Para forzar otro backend en runtime usa window.__FACEATTEND_API_URL__
//  (ver apiClient).
// ============================================================

const GATEWAY_PORT = 8000;
const DEV_TUNNEL_HOST = /^.+-\d+\.[^.]+\.devtunnels\.ms$/i;

// Este valor es reemplazado por Expo durante el build si EXPO_PUBLIC_API_URL está definida
declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };

function inferApiBaseUrl(): string {
    if (typeof window === "undefined" || !window.location?.hostname) {
        return `http://localhost:${GATEWAY_PORT}`;
    }
    const { protocol, hostname, origin } = window.location;
    if (DEV_TUNNEL_HOST.test(hostname)) {
        return origin;
    }
    return `${protocol}//${hostname}:${GATEWAY_PORT}`;
}

/** Base del API Gateway Kong. Sin slash final. */
export function getApiBaseUrl(): string {
    // Intenta leer de (en orden de precedencia):
    // 1. Variable global inyectada en runtime (window.__FACEATTEND_API_URL__)
    // 2. Variable de entorno baked en build time (EXPO_PUBLIC_API_URL, reemplazada por Expo)
    // 3. Fallback a inferApiBaseUrl()

    const globalUrl = (globalThis as any).__FACEATTEND_API_URL__?.trim();
    if (globalUrl) return globalUrl.endsWith("/") ? globalUrl.slice(0, -1) : globalUrl;

    // EXPO_PUBLIC_API_URL será reemplazada por Expo durante el build
    const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (envUrl) return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;

    // Fallback a inferencia del URL basado en el hostname
    const base = inferApiBaseUrl();
    return base.endsWith("/") ? base.slice(0, -1) : base;
}

/** Timeout por defecto de peticiones HTTP (ms). */
export const API_TIMEOUT_MS = 15000;

/** ¿Hay backend real configurado o solo mocks? */
export function getApiMode(): "live" | "mock" {
    const nodeEnv = (
        globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env;
    return nodeEnv?.EXPO_PUBLIC_API_MOCK === "1" ? "mock" : "live";
}

export const API_MODE: "live" | "mock" = getApiMode();
