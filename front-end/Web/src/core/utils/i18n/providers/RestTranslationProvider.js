// ============================================================
//  FaceAttend EDU — RestTranslationProvider (i18n · Provider)
//
//  Proveedor HTTP para el microservicio fae-translation-service.
//  Consume el endpoint de traducción con Argos Translate.
//
//  Contrato REAL del microservicio:
//
//    POST http://localhost:8000/translate
//    Content-Type: application/json
//    Body:  { "text": "...", "source": "es", "target": "en" }
//    Resp:  { "translatedText": "..." }
//
//  Configuración:
//    BASE_URL = URL base del microservicio (sin /translate al final)
//    El endpoint /translate se añade automáticamente en fetch()
//
//  Ejemplos:
//    - Desarrollo local: http://localhost:8000
//    - Docker: http://fae-translation-service:8000
//    - Producción: https://api.tudominio.com
// ============================================================

// Este archivo implementa el proveedor REST para fae-translation-service.

const BASE_URL = "http://localhost:8000"; // URL base del microservicio
const API_KEY = ""; // Clave de API si tu microservicio la requiere

// ── Implementación ────────────────────────────────────────────────────────

export class RestTranslationProvider {
    providerName = "RestTranslationProvider";

    constructor(baseUrl = BASE_URL, apiKey = API_KEY) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    /**
     * Verifica el estado del microservicio
     * @returns {Promise<{ status: string }>} - { status: "ok" } si está disponible
     * @throws {Error} - Si el servicio no está disponible o responde con error
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(
                    `[RestTranslationProvider] Health check falló: HTTP ${response.status}`
                );
            }

            const data = await response.json();
            
            if (data?.status !== "ok") {
                throw new Error(
                    `[RestTranslationProvider] Servicio no disponible: status=${data?.status || "unknown"}`
                );
            }

            return data;
        } catch (error) {
            // Re-lanzar el error con contexto adicional
            if (error instanceof TypeError && error.message.includes("fetch")) {
                throw new Error(
                    `[RestTranslationProvider] Microservicio no alcanzable en ${this.baseUrl}`
                );
            }
            throw error;
        }
    }

    async translate(text, from, to) {
        if (!text.trim()) return { translatedText: text };

        // Contrato REAL del microservicio fae-translation-service
        const body = {
            text,
            source: from,
            target: to,
        };

        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

        const response = await fetch(`${this.baseUrl}/translate`, {
            method:  "POST",
            headers,
            body:    JSON.stringify(body),
            // SIN timeout artificial - LoadingView maneja la espera
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => response.statusText);
            throw new Error(
                `[RestTranslationProvider] HTTP ${response.status} desde ${this.baseUrl}: ${errBody}`
            );
        }

        const data = await response.json();

        if (!data?.translatedText) {
            throw new Error(
                `[RestTranslationProvider] Respuesta inesperada: falta el campo translatedText`
            );
        }

        return {
            translatedText:   data.translatedText,
            detectedLanguage: data.detectedLanguage?.language,
        };
    }
}
