// ============================================================
//  DateFormatBlock — Selector de formato de fecha y hora
//  UI pura. Sin estado propio. SIMPLIFICADO.
// ============================================================
import React from "react";
import { View, Text, Switch } from "react-native";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";
import { AnimatedDropdown } from "../../../../components/common/animation/AnimatedDropdown";
import { DATE_FORMATS, formatDate, formatTime } from "../../../../../core/constants/dateFormats";

/**
 * DateFormatBlock - Bloque de configuración de formato de fecha
 * Simple: selector de formato + toggle 12h/24h
 */
export function DateFormatBlock({ dateFormat, onDateFormatChange, timeFormat24h, onTimeFormatChange }) {
    const { t } = useTranslation();
    const { c, labelStyle, descStyle } = useSettingsSectionStyles();

    if (!c) return null;

    const now = new Date();
    const dateExample = formatDate(now, dateFormat);
    const timeExample = formatTime(now, timeFormat24h);

    // Items para el dropdown de formato de fecha
    const formatItems = Object.entries(DATE_FORMATS).map(([value, config]) => ({
        value,
        label: config.label,
        description: config.example,
        icon: "calendar",
    }));

    // Label dinámico según el formato seleccionado
    const currentFormatLabel = DATE_FORMATS[dateFormat]?.label || dateFormat;

    return (
        <View style={{ gap: 16 }}>
            {/* Selector de formato de fecha */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>{t("Formato de fecha")}</Text>
                    <Text style={[descStyle, { marginTop: 0 }]}>
                        {t("Define cómo se muestran las fechas en toda la aplicación.")}
                    </Text>
                </View>
                <View style={{ width: 200 }}>
                    <AnimatedDropdown
                        items={formatItems}
                        value={dateFormat}
                        onSelect={onDateFormatChange}
                        placeholder={t("Formato")}
                        triggerIcon="calendar"
                        triggerHeight={36}
                    />
                </View>
            </View>

            {/* Toggle formato de hora */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>{t("Formato de hora")}</Text>
                    <Text style={[descStyle, { marginTop: 0 }]}>
                        {timeFormat24h 
                            ? t("Hora militar (24 horas). Ejemplo:") + " " + timeExample
                            : t("Hora estándar (12 horas con AM/PM). Ejemplo:") + " " + timeExample
                        }
                    </Text>
                </View>
                <Switch
                    value={timeFormat24h}
                    onValueChange={onTimeFormatChange}
                    trackColor={{
                        false: c.interactive.disabled,
                        true: c.brand.primary,
                    }}
                    thumbColor="#fff"
                />
            </View>
        </View>
    );
}
