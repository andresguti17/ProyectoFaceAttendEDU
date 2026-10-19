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

import React, { useState, useMemo } from "react";
import { View, Text, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { useDateFormat } from "../../hooks/useDateFormat";
import { ACADEMIC_PERIOD_TYPES } from "../../../../core/constants/academicPeriods";

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
    const { dateFormat } = useDateFormat(); // Volver a usar el hook
    const c = theme.colors;

    // Estados para validación en tiempo real
    const [startDateError, setStartDateError] = useState("");
    const [endDateError, setEndDateError] = useState("");
    
    // Convertir fecha ISO a formato de display
    const isoToDisplayFormat = React.useCallback((isoDate) => {
        if (!isoDate) return "";
        const date = new Date(isoDate);
        if (isNaN(date)) return isoDate; // Si no es válida, devolver tal como está
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        
        switch (dateFormat) {
            case "DD/MM/YYYY":
                return `${day}/${month}/${year}`;
            case "MM/DD/YYYY":
                return `${month}/${day}/${year}`;
            case "YYYY-MM-DD":
                return `${year}-${month}-${day}`;
            default:
                return `${day}/${month}/${year}`;
        }
    }, [dateFormat]);
    
    // Convertir formato de display a ISO
    const displayToIsoFormat = React.useCallback((displayDate) => {
        if (!displayDate) return "";
        
        let day, month, year;
        
        switch (dateFormat) {
            case "DD/MM/YYYY":
                const ddmmParts = displayDate.split("/");
                if (ddmmParts.length !== 3) return displayDate;
                [day, month, year] = ddmmParts;
                break;
            case "MM/DD/YYYY":
                const mmddParts = displayDate.split("/");
                if (mmddParts.length !== 3) return displayDate;
                [month, day, year] = mmddParts;
                break;
            case "YYYY-MM-DD":
                const yyyyParts = displayDate.split("-");
                if (yyyyParts.length !== 3) return displayDate;
                [year, month, day] = yyyyParts;
                break;
            default:
                return displayDate;
        }
        
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }, [dateFormat]);
    
    // Fechas formateadas para mostrar en los inputs
    const [displayStartDate, setDisplayStartDate] = useState("");
    const [displayEndDate, setDisplayEndDate] = useState("");
    
    // Actualizar fechas formateadas cuando cambie el formato o las fechas
    React.useEffect(() => {
        setDisplayStartDate(isoToDisplayFormat(startDate));
        setDisplayEndDate(isoToDisplayFormat(endDate));
    }, [startDate, endDate, dateFormat, isoToDisplayFormat]);

    // Calcular placeholders dinámicos según el formato seleccionado
    const placeholderFormat = useMemo(() => {
        switch (dateFormat) {
            case "DD/MM/YYYY":
                return "DD-MM-AAAA";
            case "MM/DD/YYYY":
                return "MM-DD-AAAA";
            case "YYYY-MM-DD":
                return "AAAA-MM-DD";
            default:
                return "AAAA-MM-DD";
        }
    }, [dateFormat]);

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
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateStr)) return false;

        const date = new Date(dateStr);
        return date instanceof Date && !isNaN(date);
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
                message: t(`Un período ${periodType} no puede durar más de ${maxDurationMonths} meses`),
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

    // Manejadores de cambio con validación
    const handleStartDateChange = (text) => {
        setDisplayStartDate(text);
        const isoDate = displayToIsoFormat(text);
        onStartDateChange(isoDate);
        if (text && !isValidDateFormat(text)) {
            setStartDateError(t("Formato inválido") + " (" + placeholderFormat + ")");
        } else {
            setStartDateError("");
        }
    };

    const handleEndDateChange = (text) => {
        setDisplayEndDate(text);
        const isoDate = displayToIsoFormat(text);
        onEndDateChange(isoDate);
        if (text && !isValidDateFormat(text)) {
            setEndDateError(t("Formato inválido") + " (" + placeholderFormat + ")");
        } else {
            setEndDateError("");
        }
    };

    // Sugerir fechas según tipo de período
    const suggestDates = () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(start);
        end.setMonth(end.getMonth() + maxDurationMonths);
        end.setDate(0); // Último día del mes anterior

        onStartDateChange(start.toISOString().split('T')[0]);
        onEndDateChange(end.toISOString().split('T')[0]);
    };

    // Exponer suggestDates al componente padre si se proporciona la ref
    React.useEffect(() => {
        if (onSuggestDatesRef) {
            onSuggestDatesRef(suggestDates);
        }
    }, [onSuggestDatesRef, maxDurationMonths]);

    const inputStyle = {
        height: 44,
        borderWidth: 1.5,
        borderColor: c.border.primary,
        borderRadius: 14,
        paddingHorizontal: 14,
        fontSize: 12,
        color: c.text.primary,
        backgroundColor: c.background.surface,
    };

    const labelStyle = {
        fontSize: 12,
        fontWeight: "600",
        color: c.text.primary,
        marginBottom: 6,
    };

    const errorInputStyle = {
        ...inputStyle,
        borderColor: c.status.danger,
    };

    const successInputStyle = {
        ...inputStyle,
        borderColor: c.status.success,
    };

    return (
        <View style={{ gap: 12 }}>
            {/* Campos de entrada de fecha */}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {/* Fecha de inicio */}
                <View style={{ width: 120 }}>
                    <Text style={labelStyle}>{t("Fecha de inicio")}</Text>
                    <View style={{ position: "relative" }}>
                        <TextInput
                            value={displayStartDate}
                            onChangeText={handleStartDateChange}
                            style={
                                startDateError
                                    ? errorInputStyle
                                    : validation.isValid
                                    ? successInputStyle
                                    : inputStyle
                            }
                            placeholder={placeholderFormat}
                            placeholderTextColor={c.text.disabled}
                        />
                        {validation.isValid && (
                            <View
                                style={{
                                    position: "absolute",
                                    right: 12,
                                    top: 12,
                                }}
                            >
                                <Feather
                                    name="check-circle"
                                    size={18}
                                    color={c.status.success}
                                />
                            </View>
                        )}
                    </View>
                </View>
                {/* Fecha de fin */}
                <View style={{ width: 120 }}>
                    <Text style={labelStyle}>{t("Fecha de fin")}</Text>
                    <View style={{ position: "relative" }}>
                        <TextInput
                            value={displayEndDate}
                            onChangeText={handleEndDateChange}
                            style={
                                endDateError
                                    ? errorInputStyle
                                    : validation.isValid
                                    ? successInputStyle
                                    : inputStyle
                            }
                            placeholder={placeholderFormat}
                            placeholderTextColor={c.text.disabled}
                        />
                        {validation.isValid && (
                            <View
                                style={{
                                    position: "absolute",
                                    right: 12,
                                    top: 12,
                                }}
                            >
                                <Feather
                                    name="check-circle"
                                    size={18}
                                    color={c.status.success}
                                />
                            </View>
                        )}
                    </View>
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
