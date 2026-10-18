// ============================================================
//  useDateFormat - Hook para formatear fechas según config
// ============================================================

import { useState, useCallback, useEffect } from "react";
import { getInstitutionConfig, onInstitutionConfigChange } from "../../../core/config/institutionConfig";
import {
    formatDate as formatDateUtil,
    formatTime as formatTimeUtil,
    formatDateTime as formatDateTimeUtil,
} from "../../../core/constants/dateFormats";

/**
 * Hook para obtener y usar el formato de fecha configurado
 * Se suscribe automáticamente a cambios de configuración
 */
export function useDateFormat() {
    // Estado reactivo para la configuración
    const [config, setConfig] = useState(() => {
        const cfg = getInstitutionConfig();
        return {
            dateFormat: cfg.dateFormat || "DD/MM/YYYY",
            timeFormat24h: cfg.timeFormat24h ?? false,
        };
    });

    // Suscribirse a cambios de configuración
    useEffect(() => {
        const unsubscribe = onInstitutionConfigChange((newConfig) => {
            setConfig({
                dateFormat: newConfig.dateFormat || "DD/MM/YYYY",
                timeFormat24h: newConfig.timeFormat24h ?? false,
            });
        });
        
        return unsubscribe;
    }, []);

    // Función para formatear fechas. Acepta un formato opcional que sobrescribe
    // el configurado (antes el 2º argumento se ignoraba siempre).
    const formatDate = useCallback(
        (date, overrideFormat) => {
            return formatDateUtil(date, overrideFormat || config.dateFormat);
        },
        [config.dateFormat]
    );

    // Función para formatear horas. Acepta un override opcional de 12h/24h.
    const formatTime = useCallback(
        (date, override24h) => {
            return formatTimeUtil(date, override24h ?? config.timeFormat24h);
        },
        [config.timeFormat24h]
    );

    // Función para formatear fecha y hora (con overrides opcionales).
    const formatDateTime = useCallback(
        (date, overrideDateFormat, override24h) => {
            return formatDateTimeUtil(
                date,
                overrideDateFormat || config.dateFormat,
                override24h ?? config.timeFormat24h
            );
        },
        [config.dateFormat, config.timeFormat24h]
    );
    
    // Función para formatear fecha para inputs HTML (YYYY-MM-DD)
    const formatDateForInput = useCallback(
        (date) => {
            if (!date) return "";
            const d = new Date(date);
            if (isNaN(d.getTime())) return "";
            
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            
            return `${year}-${month}-${day}`;
        },
        []
    );

    return {
        dateFormat: config.dateFormat,
        timeFormat24h: config.timeFormat24h,
        formatDate,
        formatTime,
        formatDateTime,
        formatDateForInput,
    };
}
