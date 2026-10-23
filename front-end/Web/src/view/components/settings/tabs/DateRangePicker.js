// ============================================================
//  DateRangePicker — Selector de rango de fechas para períodos académicos
// ============================================================
//  Permite seleccionar fecha de inicio y fin del período académico
//  con validación automática según el tipo de período (trimestral,
//  cuatrimestral, semestral, anual).
//
//  Features:
//  - Validación de duración máxima según tipo de período
//  - Formato de fecha consistente (YYYY-MM-DD)
//  - Indicadores visuales de validación
//  - Cálculo automático de duración en días/semanas/meses
// ============================================================

import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { DateInput } from "../../common/inputs/DateInput";
import { ACADEMIC_PERIOD_TYPES, ACADEMIC_PERIOD_CONFIG } from "../../../../core/constants/academicPeriods";

/**
 * Componente para seleccionar rango de fechas del período académico
 * 
 * @param {Object} props
 * @param {string} props.startDate - Fecha de inicio en formato YYYY-MM-DD
 * @param {string} props.endDate - Fecha de fin en formato YYYY-MM-DD
 * @param {function} props.onStartDateChange - Callback cuando cambia fecha inicio
 * @param {function} props.onEndDateChange - Callback cuando cambia fecha fin
 * @param {string} props.periodType - Tipo de período (trimestral, semestral, etc.)
 * @param {function} props.onSuggestDatesRef - Ref para exponer la función suggestDates (opcional)
 */
export function DateRangePicker({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    periodType = ACADEMIC_PERIOD_TYPES.TRIMESTRAL,
    onSuggestDatesRef,
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Configuración de duración máxima según tipo de período
    const maxDurationMonths = useMemo(() => {
        switch (periodType) {
            case ACADEMIC_PERIOD_TYPES.ANNUAL:
                return 12; // 1 año
            case ACADEMIC_PERIOD_TYPES.SEMESTRAL:
                return 6; // 6 meses
            case ACADEMIC_PERIOD_TYPES.QUARTERLY:
                return 4; // 4 meses
            case ACADEMIC_PERIOD_TYPES.TRIMESTRAL:
                return 3; // 3 meses
            default:
                return 3;
        }
    }, [periodType]);

    // Validar formato de fecha YYYY-MM-DD
    const isValidDateFormat = (dateStr) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? "");
        if (!match) return false;

        // Ida y vuelta por Date: rechaza días inexistentes (31/02, mes 13).
        const [, y, m, d] = match.map(Number);
        const date = new Date(y, m - 1, d);
        return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    };

    // Calcular diferencia en días entre dos fechas
    const getDaysDifference = (start, end) => {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        return Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
    };

    // Calcular diferencia en meses aproximados
    const getMonthsDifference = (start, end) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        return (
            (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth())
        );
    };

    // Validar rango de fechas completo
    const validation = useMemo(() => {
        // Primero: validar formato si al menos una fecha está ingresada
        if (startDate && !isValidDateFormat(startDate)) {
            return {
                isValid: false,
                days: 0,
                weeks: 0,
                months: 0,
                message: t("Formato de fecha inválido (usa AAAA-MM-DD)"),
                type: "error",
            };
        }

        if (endDate && !isValidDateFormat(endDate)) {
            return {
                isValid: false,
                days: 0,
                weeks: 0,
                months: 0,
                message: t("Formato de fecha inválido (usa AAAA-MM-DD)"),
                type: "error",
            };
        }

        // Segundo: verificar que ambas fechas estén completas
        if (!startDate || !endDate) {
            return {
                isValid: false,
                days: 0,
                weeks: 0,
                months: 0,
                message: t("Selecciona ambas fechas"),
                type: "info",
            };
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end <= start) {
            return {
                isValid: false,
                days: 0,
                weeks: 0,
                months: 0,
                message: t("La fecha de fin debe ser posterior a la fecha de inicio"),
                type: "error",
            };
        }

        const days = getDaysDifference(startDate, endDate);
        const weeks = Math.round(days / 7);
        const months = getMonthsDifference(startDate, endDate);

        // Validar duración máxima según tipo de período
        if (months > maxDurationMonths) {
            return {
                isValid: false,
                days,
                weeks,
                months,
                message: `${t("Un período")} ${t(ACADEMIC_PERIOD_CONFIG[periodType]?.labelKey ?? "").toLowerCase()} ${t("no puede durar más de")} ${maxDurationMonths} ${t("meses")}`,
                type: "error",
            };
        }

        // Duración mínima: al menos 4 semanas
        if (days < 28) {
            return {
                isValid: false,
                days,
                weeks,
                months,
                message: t("El período debe durar al menos 4 semanas (28 días)"),
                type: "error",
            };
        }

        return {
            isValid: true,
            days,
            weeks,
            months,
            message: t("Rango de fechas válido"),
            type: "success",
        };
    }, [startDate, endDate, periodType, maxDurationMonths, t]);

    // Los campos usan DateInput: máscara y formato configurado (Ajustes > Formato de fecha),
    // separadores automáticos y día/mes ajustados; aquí solo llega la fecha ISO (o "").
    // Sugerir fechas según tipo de período
    const suggestDates = () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(start);
        end.setMonth(end.getMonth() + maxDurationMonths);
        end.setDate(0); // Último día del mes anterior

        // Fecha local: toISOString() la pasa a UTC y puede correr el día.
        const toLocalIso = (d) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        onStartDateChange(toLocalIso(start));
        onEndDateChange(toLocalIso(end));
    };

    // Exponer suggestDates al componente padre si se proporciona la ref
    React.useEffect(() => {
        if (onSuggestDatesRef) {
            onSuggestDatesRef(suggestDates);
        }
    }, [onSuggestDatesRef, maxDurationMonths]);

    const labelStyle = {
        fontSize: 12,
        fontWeight: "600",
        color: c.text.primary,
        marginBottom: 6,
    };

    return (
        <View style={{ gap: 12 }}>
            {/* Campos de entrada de fecha */}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View style={{ width: 160 }}>
                    <DateInput
                        label={t("Fecha de inicio")}
                        value={startDate || ""}
                        onChangeText={onStartDateChange}
                        error={validation.type === "error"}
                        success={validation.isValid}
                    />
                </View>
                <View style={{ width: 160 }}>
                    <DateInput
                        label={t("Fecha de fin")}
                        value={endDate || ""}
                        onChangeText={onEndDateChange}
                        error={validation.type === "error"}
                        success={validation.isValid}
                    />
                </View>

                {/* Indicador de validación y estadísticas - como tercer campo */}
                <View style={{ alignSelf: "flex-start" }}>
                    <Text style={labelStyle}>{" "}</Text>
                    <View
                        style={{
                            backgroundColor:
                                validation.type === "success"
                                    ? c.status.successLight
                                    : validation.type === "error"
                                    ? c.status.dangerLight
                                    : c.status.infoLight,
                            borderRadius: 14,
                            padding: 12,
                            flexDirection: "row",
                            gap: 8,
                            height: 44,
                            alignItems: "center",
                        }}
                    >
                        <Feather
                            name={
                                validation.type === "success"
                                    ? "check-circle"
                                    : validation.type === "error"
                                    ? "alert-circle"
                                    : "info"
                            }
                            size={16}
                            color={
                                validation.type === "success"
                                    ? c.status.success
                                    : validation.type === "error"
                                    ? c.status.danger
                                    : c.status.info
                            }
                        />
                        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color:
                                        validation.type === "success"
                                            ? c.status.successDark
                                            : validation.type === "error"
                                            ? c.status.dangerDark
                                            : c.status.infoDark,
                                }}
                            >
                                {validation.isValid ? (
                                    <>
                                        <Text>✓ </Text>
                                        <Text style={{ fontSize: 13, color: c.status.successDark }}>
                                            {validation.days} {t("días")}
                                        </Text>
                                        <Text> · </Text>
                                        <Text style={{ fontSize: 13, color: c.status.successDark }}>
                                            {validation.weeks} {t("semanas")}
                                        </Text>
                                        <Text> · </Text>
                                        <Text style={{ fontSize: 13, color: c.status.successDark }}>
                                            {validation.months} {t("meses")}
                                        </Text>
                                    </>
                                ) : (
                                    validation.message
                                )}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

export default DateRangePicker;
