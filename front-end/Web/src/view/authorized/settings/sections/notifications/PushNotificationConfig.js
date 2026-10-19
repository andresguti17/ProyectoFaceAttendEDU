// ============================================================
//  PushNotificationToggle — Toggle con input de duración integrado
//
//  Toggle de notificaciones push con input a la derecha para
//  configurar la duración en segundos. Validaciones inline debajo.
//
//  Props:
//   - enabled / onToggle          : bool + setter
//   - duration / onDurationChange : number (en segundos) + setter
//   - description                 : string
//
//  PushNotificationLimit — Input para límite máximo de notificaciones
//
//  Input simple para configurar el número máximo de notificaciones
//  simultáneas. Solo visible cuando push notifications están habilitadas.
//
//  Props:
//   - limit / onLimitChange : number + setter
// ============================================================

import React, { useState } from "react";
import { View, Text, TextInput, Switch } from "react-native";
import { Divider } from "../../../../components/common";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { useTheme } from "../../../../components/hooks/useTheme";
import { useDynamicInputWidth } from "../../../../components/hooks/useDynamicInputWidth";

// ============================================================
// Configuración de límites para notificaciones push
// ============================================================
const MAX_MINUTES = 8; // Valor base centralizado

const PUSH_NOTIFICATION_LIMITS = {
    // Límites de duración
    MIN_SECONDS: 1,
    MAX_MINUTES: MAX_MINUTES,            // Máximo en minutos
    MAX_SECONDS: MAX_MINUTES * 60,       // Máximo en segundos (calculado automáticamente)
    WARNING_THRESHOLD: 60,               // Umbral de advertencia en segundos (1 minuto)
    
    // Umbrales para mensajes contextuales
    IDEAL_MIN: 4,
    IDEAL_MAX: 15,
    MODERATE_MAX: 60,
};

export function PushNotificationToggle({
    enabled,
    onToggle,
    duration,
    onDurationChange,
    description,
}) {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const c = theme.colors;
    
    // Estado completamente independiente - inicializar UNA VEZ con la prop, luego nunca más sincronizar
    const [inputValue, setInputValue] = useState(() => {
        // Calcular valor inicial SOLO una vez
        if (duration > 0) {
            // Asegurar que no exceda el máximo permitido
            const clampedDuration = Math.min(duration, PUSH_NOTIFICATION_LIMITS.MAX_SECONDS);
            
            // Si la duración es exactamente divisible por 60, mostrar en minutos
            if (clampedDuration % 60 === 0 && clampedDuration >= 60) {
                const minutes = clampedDuration / 60;
                return `${minutes}min`;
            }
            // Si no, mostrar en segundos
            return `${clampedDuration}s`;
        }
        return "4s";
    });
    const [error, setError] = useState("");

    // Configuración de caracteres permitidos
    const allowedChars = ["0-9", ".", "s", "m", "i", "n"];
    
    const validateAndUpdate = (text) => {
        // Construir regex dinámicamente desde allowedChars
        const allowedPattern = allowedChars.join("");
        const cleanRegex = new RegExp(`[^${allowedPattern}]`, "gi");
        const cleanText = text.replace(cleanRegex, "");
        setInputValue(cleanText);
        setError("");

        // Si está vacío, solo marcar error
        if (!cleanText || cleanText.trim() === "") {
            setError(t("Campo requerido"));
            return;
        }

        // Parsear según el formato SOLO para validación (sin actualizar el valor final)
        let seconds = 0;
        const lowerText = cleanText.toLowerCase();
        
        if (lowerText.endsWith("min")) {
            // Formato en minutos: "0.5min", "1min", "15min"
            const minValue = parseFloat(lowerText.replace("min", ""));
            if (isNaN(minValue)) {
                setError(t("Debe ser un número válido"));
                return;
            }
            seconds = minValue * 60;
        } else if (lowerText.endsWith("s")) {
            // Formato en segundos: "30s", "900s"
            const secValue = parseFloat(lowerText.replace("s", ""));
            if (isNaN(secValue)) {
                setError(t("Debe ser un número válido"));
                return;
            }
            seconds = secValue;
        } else {
            // Solo número sin unidad - asumir segundos
            const num = parseFloat(cleanText);
            if (isNaN(num)) {
                setError(t("Debe ser un número válido"));
                return;
            }
            seconds = num;
        }

        // Validar rango mínimo
        if (seconds < PUSH_NOTIFICATION_LIMITS.MIN_SECONDS) {
            setError(t("Mínimo 1 segundo"));
            return;
        }

        // Validaciones contextuales
        if (seconds <= 3) {
            setError(t("Muy rápido — Las notificaciones desaparecerán casi de inmediato"));
            return;
        }

        // Validar rango máximo usando constantes parametrizables
        if (seconds > PUSH_NOTIFICATION_LIMITS.MAX_SECONDS) {
            // Mensaje dinámico según el formato que el usuario está usando
            if (lowerText.endsWith("min")) {
                setError(t(`Máximo ${PUSH_NOTIFICATION_LIMITS.MAX_MINUTES} minutos (${PUSH_NOTIFICATION_LIMITS.MAX_SECONDS} segundos)`));
            } else {
                setError(t(`Máximo ${PUSH_NOTIFICATION_LIMITS.MAX_SECONDS} segundos (${PUSH_NOTIFICATION_LIMITS.MAX_MINUTES} minutos)`));
            }
            return;
        }

        if (seconds > PUSH_NOTIFICATION_LIMITS.WARNING_THRESHOLD) {
            // Mensaje dinámico para advertencia también
            const warningMinutes = Math.round(PUSH_NOTIFICATION_LIMITS.WARNING_THRESHOLD / 60);
            if (lowerText.endsWith("min")) {
                setError(t(`Muy largo — Las notificaciones ocuparán espacio por mucho tiempo (más de ${warningMinutes} minuto${warningMinutes > 1 ? 's' : ''})`));
            } else {
                setError(t("Muy largo — Las notificaciones ocuparán espacio por mucho tiempo"));
            }
            return;
        }

        // NO actualizar el valor final aquí - solo validar
        setError("");
    };

    const handleBlur = () => {
        // Si está vacío al hacer blur, mostrar error
        if (!inputValue || inputValue.trim() === "") {
            setError(t("Campo requerido"));
            return;
        }

        const trimmed = inputValue.trim();
        const lowerText = trimmed.toLowerCase();
        
        let displayValue = trimmed; // Valor que se mostrará en el input (SIN CAMBIOS)
        let seconds = 0; // Valor en segundos para el sistema

        // Si es solo número sin unidad, agregar 's' visualmente
        if (!lowerText.endsWith("s") && !lowerText.endsWith("min")) {
            const num = parseFloat(trimmed);
            if (!isNaN(num)) {
                displayValue = `${num}s`; // Agregar 's' solo para números sin unidad
                seconds = num;
            }
        } else {
            // Ya tiene unidad, mantener formato visual pero calcular segundos
            displayValue = trimmed; // Mantener formato original ("3min", "30s", etc.)
            
            if (lowerText.endsWith("min")) {
                const minValue = parseFloat(lowerText.replace("min", ""));
                if (!isNaN(minValue)) {
                    seconds = minValue * 60; // Conversión interna a segundos
                }
            } else if (lowerText.endsWith("s")) {
                const secValue = parseFloat(lowerText.replace("s", ""));
                if (!isNaN(secValue)) {
                    seconds = secValue;
                }
            }
        }

        // Actualizar el input con el valor visual (mantener formato del usuario)
        setInputValue(displayValue);
        
        // Guardar los segundos internamente SIN marcar como actualización interna
        if (seconds > 0) {
            onDurationChange(Math.round(seconds));
        }
    };

    const handleToggle = () => {
        onToggle();
        // Si se está habilitando y no hay valor, establecer por defecto
        if (!enabled && duration === 0) {
            onDurationChange(4); // 4 segundos por defecto
        }
    };

    // Determinar el mensaje contextual según el valor en segundos
    const getContextualMessage = () => {
        if (!inputValue || error) return null;
        
        // Parsear a segundos para validación contextual
        let seconds = 0;
        const lowerText = inputValue.toLowerCase();
        const isMinuteFormat = lowerText.endsWith("min");
        
        if (lowerText.endsWith("min")) {
            const minValue = parseFloat(lowerText.replace("min", ""));
            if (isNaN(minValue)) return null;
            seconds = minValue * 60;
        } else if (lowerText.endsWith("s")) {
            const secValue = parseFloat(lowerText.replace("s", ""));
            if (isNaN(secValue)) return null;
            seconds = secValue;
        } else {
            const num = parseFloat(inputValue);
            if (isNaN(num)) return null;
            seconds = num;
        }

        if (seconds >= PUSH_NOTIFICATION_LIMITS.IDEAL_MIN && seconds <= PUSH_NOTIFICATION_LIMITS.IDEAL_MAX) {
            return {
                color: c.status.success,
                text: t("Ideal — Tiempo suficiente para leer sin ser intrusiva")
            };
        }
        if (seconds > PUSH_NOTIFICATION_LIMITS.IDEAL_MAX && seconds <= PUSH_NOTIFICATION_LIMITS.MODERATE_MAX) {
            return {
                color: c.brand.primary,
                text: isMinuteFormat 
                    ? t("Moderado — Bueno para notificaciones importantes (1 minuto)")
                    : t("Moderado — Bueno para notificaciones importantes")
            };
        }
        if (seconds > PUSH_NOTIFICATION_LIMITS.MODERATE_MAX && seconds <= PUSH_NOTIFICATION_LIMITS.MAX_SECONDS) {
            const minutes = Math.round(seconds / 60 * 10) / 10; // Redondear a 1 decimal
            return {
                color: c.brand.primary,
                text: isMinuteFormat
                    ? t(`Largo — Útil para alertas que requieren atención (${minutes} min)`)
                    : t("Largo — Útil para alertas que requieren atención")
            };
        }
        
        return null;
    };

    const contextualMessage = getContextualMessage();

    // Calcular ancho dinámico del input basado en la cantidad de caracteres
    const inputWidth = useDynamicInputWidth(inputValue, {
        baseWidth: 20,
        pixelsPerChar: 6,
        minChars: 1,
        maxWidth: null,
        charType: allowedChars,
    });

    return (
        <>
            <View style={{ paddingVertical: 12 }}>
                {/* Fila principal con label, input y switch */}
                <View style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    {/* Label */}
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: "500",
                            color: c.text.primary,
                            marginBottom: 4,
                        }}>
                            {t("Notificaciones push")}
                        </Text>
                        {description && (
                            <Text style={{
                                fontSize: 12,
                                color: c.text.secondary,
                                lineHeight: 18,
                            }}>
                                {description}
                            </Text>
                        )}
                    </View>

                    {/* Input de duración con label integrado (solo visible si está habilitado) */}
                    {enabled && (
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: c.background.surface,
                            borderWidth: 1,
                            borderColor: error ? c.status.danger : contextualMessage ? contextualMessage.color : c.border.primary,
                            borderRadius: 8,
                            paddingLeft: 8,
                            paddingRight: 8,
                            paddingVertical: 10,
                            marginRight: 12,
                        }}>
                            <Text style={{
                                fontSize: 14,
                                color: c.text.secondary,
                            }}>
                                {t("Duración: ")}
                            </Text>
                            <View style={{ width: inputWidth, alignItems: "center" }}>
                                <TextInput
                                    style={{
                                        fontSize: 14,
                                        color: c.text.primary,
                                        width: "100%",
                                        textAlign: "center",
                                        outlineStyle: "none",
                                    }}
                                    value={inputValue}
                                    onChangeText={validateAndUpdate}
                                    onBlur={handleBlur}
                                    keyboardType="numeric"
                                    placeholder=""
                                    placeholderTextColor={c.text.disabled}
                                />
                            </View>
                        </View>
                    )}

                    {/* Switch */}
                    <Switch
                        value={enabled}
                        onValueChange={handleToggle}
                        trackColor={{
                            false: c.interactive.disabled,
                            true: c.brand.primary,
                        }}
                        thumbColor={c.text.onBrand}
                    />
                </View>

                {/* Mensaje de error o contextual - con margin bottom negativo de -10 para compensar el padding del contenedor */}
                {enabled && (error || contextualMessage) && (
                    <Text style={{
                        fontSize: 12,
                        color: error ? c.status.danger : contextualMessage?.color,
                        marginTop: 4,
                        marginBottom: -10,
                    }}>
                        {error || contextualMessage?.text}
                    </Text>
                )}
            </View>
            <Divider />
        </>
    );
}

// ============================================================
//  PushNotificationLimit — Input para límites de notificaciones
// ============================================================

export function PushNotificationLimit({ limit, limitByType, onLimitChange, onLimitByTypeChange }) {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const c = theme.colors;
    
    const [totalInputValue, setTotalInputValue] = useState(limit > 0 ? limit.toString() : "15");
    const [typeInputValue, setTypeInputValue] = useState(limitByType > 0 ? limitByType.toString() : "5");
    const [totalError, setTotalError] = useState("");
    const [typeError, setTypeError] = useState("");

    // Sincronizar con props
    React.useEffect(() => {
        if (limit > 0) {
            setTotalInputValue(limit.toString());
        }
    }, [limit]);

    React.useEffect(() => {
        if (limitByType > 0) {
            setTypeInputValue(limitByType.toString());
        }
    }, [limitByType]);

    const validateAndUpdateTotal = (text) => {
        const cleanText = text.replace(/[^0-9]/g, "");
        setTotalInputValue(cleanText);

        if (!cleanText || cleanText === "") {
            setTotalError(t("Campo requerido"));
            return;
        }

        const number = parseInt(cleanText, 10);
        
        if (isNaN(number) || number < 1) {
            setTotalError(t("Mínimo 1 notificación"));
            return;
        }

        if (number > 50) {
            setTotalError(t("Máximo 50 notificaciones"));
            return;
        }

        setTotalError("");
        onLimitChange(number);
    };

    const validateAndUpdateType = (text) => {
        const cleanText = text.replace(/[^0-9]/g, "");
        setTypeInputValue(cleanText);

        if (!cleanText || cleanText === "") {
            setTypeError(t("Campo requerido"));
            return;
        }

        const number = parseInt(cleanText, 10);
        
        if (isNaN(number) || number < 1) {
            setTypeError(t("Mínimo 1 notificación"));
            return;
        }

        if (number > 15) {
            setTypeError(t("Máximo 15 notificaciones"));
            return;
        }

        setTypeError("");
        onLimitByTypeChange(number);
    };

    return (
        <>
            <View style={{ paddingVertical: 12 }}>
                {/* Título de sección */}
                <Text style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: c.text.primary,
                    marginBottom: 12,
                }}>
                    {t("Límites de notificaciones")}
                </Text>

                {/* Límite total */}
                <View style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{
                            fontSize: 13,
                            fontWeight: "500",
                            color: c.text.primary,
                            marginBottom: 2,
                        }}>
                            {t("Límite total mostrado")}
                        </Text>
                        <Text style={{
                            fontSize: 11,
                            color: c.text.secondary,
                            lineHeight: 16,
                        }}>
                            {t("Máximo de notificaciones visibles en pantalla")}
                        </Text>
                    </View>

                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: c.background.surface,
                        borderWidth: 1,
                        borderColor: totalError ? c.status.danger : c.border.primary,
                        borderRadius: 8,
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingVertical: 8,
                    }}>
                        <Text style={{
                            fontSize: 13,
                            color: c.text.secondary,
                        }}>
                            {t("Total: ")}
                        </Text>
                        <View style={{ width: 40, alignItems: "center" }}>
                            <TextInput
                                style={{
                                    fontSize: 13,
                                    color: c.text.primary,
                                    width: "100%",
                                    textAlign: "center",
                                    outlineStyle: "none",
                                }}
                                value={totalInputValue}
                                onChangeText={validateAndUpdateTotal}
                                keyboardType="numeric"
                                placeholder="15"
                                placeholderTextColor={c.text.disabled}
                                maxLength={2}
                            />
                        </View>
                    </View>
                </View>

                {/* Límite por tipo */}
                <View style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{
                            fontSize: 13,
                            fontWeight: "500",
                            color: c.text.primary,
                            marginBottom: 2,
                        }}>
                            {t("Límite por tipo")}
                        </Text>
                        <Text style={{
                            fontSize: 11,
                            color: c.text.secondary,
                            lineHeight: 16,
                        }}>
                            {t("Máximo de notificaciones del mismo tipo")}
                        </Text>
                    </View>

                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: c.background.surface,
                        borderWidth: 1,
                        borderColor: typeError ? c.status.danger : c.border.primary,
                        borderRadius: 8,
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingVertical: 8,
                    }}>
                        <Text style={{
                            fontSize: 13,
                            color: c.text.secondary,
                        }}>
                            {t("Tipo: ")}
                        </Text>
                        <View style={{ width: 40, alignItems: "center" }}>
                            <TextInput
                                style={{
                                    fontSize: 13,
                                    color: c.text.primary,
                                    width: "100%",
                                    textAlign: "center",
                                    outlineStyle: "none",
                                }}
                                value={typeInputValue}
                                onChangeText={validateAndUpdateType}
                                keyboardType="numeric"
                                placeholder="5"
                                placeholderTextColor={c.text.disabled}
                                maxLength={2}
                            />
                        </View>
                    </View>
                </View>

                {/* Mensajes de error */}
                {(totalError || typeError) && (
                    <Text style={{
                        fontSize: 11,
                        color: c.status.danger,
                        marginTop: 6,
                        marginBottom: -8,
                    }}>
                        {totalError || typeError}
                    </Text>
                )}
            </View>
            <Divider />
        </>
    );
}