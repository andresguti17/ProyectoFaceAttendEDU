// ============================================================
//  useAutomaticPeriodAdvance — Hook para avanzar períodos automáticamente
// ============================================================
//  Hook que verifica si el período académico ha expirado y
//  si está en modo automático, avanza al próximo período
//  calculando las fechas basándose en la duración del anterior.
//
//  Se ejecuta al montar y periódicamente (cada 1 hora por defecto)
// ============================================================

import { useEffect } from "react";
import { 
    getInstitutionConfig,
    checkPeriodExpiration,
    advanceToNextPeriod,
} from "../../../core/config/institutionConfig";

/**
 * Hook para avanzar automáticamente al próximo período cuando expira
 * 
 * @param {boolean} enabled - Si el auto-advance está habilitado (default: true)
 * @param {number} checkIntervalMinutes - Intervalo de verificación en minutos (default: 60)
 * @returns {Object} { lastCheck, hasAdvanced, error }
 */
export function useAutomaticPeriodAdvance(enabled = true, checkIntervalMinutes = 60) {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const checkAndAdvance = async () => {
            try {
                const config = getInstitutionConfig();
                
                // Solo avanzar si está en modo automático
                if (!config.isAutomaticPeriod) {
                    console.log("[PeriodAdvance] Modo manual activado, no se avanzará automáticamente");
                    return;
                }

                // Verificar si el período ha expirado
                const expiration = checkPeriodExpiration();
                
                if (expiration.hasExpired) {
                    console.log(`[PeriodAdvance] Período expirado hace ${expiration.daysOverdue} días. Avanzando al próximo período...`);
                    
                    const success = await advanceToNextPeriod();
                    
                    if (success) {
                        console.log("[PeriodAdvance] ✅ Período avanzado exitosamente y horarios borrados");
                        
                        // Emitir evento custom para notificar a componentes
                        window.dispatchEvent(new CustomEvent("periodAdvanced", {
                            detail: {
                                timestamp: new Date().toISOString(),
                                daysOverdue: expiration.daysOverdue,
                            }
                        }));
                    } else {
                        console.warn("[PeriodAdvance] ⚠️ No se pudo avanzar el período automáticamente");
                    }
                } else if (expiration.isExpiringSoon) {
                    console.log(`[PeriodAdvance] Período expira en ${expiration.daysRemaining} días`);
                } else {
                    console.log(`[PeriodAdvance] Período activo. Quedan ${expiration.daysRemaining} días`);
                }
            } catch (error) {
                console.error("[PeriodAdvance] Error al verificar/avanzar período:", error);
            }
        };

        // Ejecutar al montar
        checkAndAdvance();

        // Configurar intervalo de verificación
        const intervalMs = checkIntervalMinutes * 60 * 1000;
        const interval = setInterval(checkAndAdvance, intervalMs);

        console.log(`[PeriodAdvance] Verificación automática configurada cada ${checkIntervalMinutes} minutos`);

        // Cleanup
        return () => {
            clearInterval(interval);
            console.log("[PeriodAdvance] Verificación automática detenida");
        };
    }, [enabled, checkIntervalMinutes]);
}

export default useAutomaticPeriodAdvance;
