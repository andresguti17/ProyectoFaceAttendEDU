// ============================================================
//  GeneralSummary — Resumen actual de configuración general
//  UI pura. Muestra los valores actuales en StatsRows.
//
//  Props:
//   - institutionName    : string
//   - academicPeriodType : string
//   - periodStartDate    : string
//   - periodEndDate      : string
//   - isAutomaticPeriod  : bool
//   - automaticPeriod    : objeto calculado
//   - currentLanguageLabel : string
//   - dateFormat         : string
//   - timeFormat24h      : boolean
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Divider } from "../../../../components/common";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { StatsRow } from "../../../../components/settings/tabs";
import {
    ACADEMIC_PERIOD_CONFIG,
    getFullPeriodLabel,
} from "../../../../../core/constants/academicPeriods";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function GeneralSummary({
    institutionName,
    academicPeriodType,
    periodStartDate,
    periodEndDate,
    isAutomaticPeriod,
    automaticPeriod,
    currentLanguageLabel,
    dateFormat,
    timeFormat24h,
}) {
    const { t } = useTranslation();
    const { c } = useSettingsSectionStyles();

    // Label del formato
    const formatLabel = `${dateFormat} · ${timeFormat24h ? "24h" : "12h"}`;

    return (
        <View style={{ gap: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: c.text.secondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                {t("Resumen actual")}
            </Text>
            <StatsRow label={t("Institución")} value={institutionName || t("Sin definir")} icon="home" color={c.brand.primary} />
            <Divider />
            <StatsRow
                label={t("Período académico")}
                value={t(ACADEMIC_PERIOD_CONFIG[academicPeriodType]?.labelKey) || t("Sin definir")}
                icon="book-open"
                color="#F59E0B"
            />
            <Divider />
            <StatsRow
                label={t("Período actual")}
                value={
                    periodStartDate && periodEndDate
                        ? `${getFullPeriodLabel(automaticPeriod)} ${isAutomaticPeriod ? t("(Auto)") : t("(Manual)")}`
                        : t("No configurado - usar división del año")
                }
                icon="calendar-check"
                color="#8B5CF6"
            />
            <Divider />
            <StatsRow label={t("Idioma")} value={currentLanguageLabel ?? t("Español")} icon="globe" color="#3B82F6" />
            <Divider />
            <StatsRow 
                label={t("Formato de fecha")} 
                value={formatLabel} 
                icon="calendar" 
                color="#10B981" 
            />
        </View>
    );
}
