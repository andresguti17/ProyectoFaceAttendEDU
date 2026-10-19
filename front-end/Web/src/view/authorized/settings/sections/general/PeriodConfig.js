// ============================================================
//  PeriodConfig — Configuración del período académico actual
//  Modo automático/manual + DateRangePicker + InfoModal.
//  UI pura. Sin estado propio.
//
//  Props:
//   - periodStartDate / onStartDateChange : string + setter
//   - periodEndDate / onEndDateChange     : string + setter
//   - isAutomaticPeriod / onModeChange    : bool + setter
//   - academicPeriodType                  : string
//   - automaticPeriod                     : objeto calculado
//   - periodExpiration                    : objeto de expiración
//   - showExpirationAlert                 : bool
//   - onDismissExpiration                 : () => void
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, InfoModal } from "../../../../components/common";
import { PeriodExpirationAlert } from "../../../../components/settings/PeriodExpirationAlert";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { DateRangePicker } from "../../../../components/settings/tabs";
import { getFullPeriodLabel } from "../../../../../core/constants/academicPeriods";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function PeriodConfig({
    periodStartDate, onStartDateChange,
    periodEndDate,   onEndDateChange,
    isAutomaticPeriod, onModeChange,
    academicPeriodType,
    automaticPeriod,
    periodExpiration,
    showExpirationAlert,
    onDismissExpiration,
}) {
    const { t } = useTranslation();
    const { c, labelStyle, descStyle } = useSettingsSectionStyles();

    const [showInfoModal, setShowInfoModal] = React.useState(false);
    const suggestDatesRef = React.useRef(null);

    return (
        <View style={{ gap: 12 }}>
            {/* Alerta de expiración */}
            {periodExpiration &&
                (periodExpiration.hasExpired || periodExpiration.isExpiringSoon) &&
                showExpirationAlert && (
                    <PeriodExpirationAlert
                        expirationInfo={periodExpiration}
                        isAutomaticMode={isAutomaticPeriod}
                        onConfigure={onDismissExpiration}
                        onDismiss={onDismissExpiration}
                    />
                )}

            {/* Encabezado */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>{t("Configuración del período académico actual")}</Text>
                    <Text style={[descStyle, { marginTop: 6, marginBottom: 2}]}>
                        {t("Define las fechas del período actual. En modo automático, se calculará el próximo período basándose en la duración del actual.")}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => setShowInfoModal(true)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
                >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: c.brand.primary, textDecorationLine: "underline" }}>
                        {t("¿Cómo funciona?")}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Botones de modo */}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Button
                    variant={isAutomaticPeriod ? "primary" : "outline"}
                    size="sm"
                    onPress={() => onModeChange(true)}
                    style={{ minWidth: 120 }}
                >
                    <Feather name="zap" size={14} color={isAutomaticPeriod ? "#fff" : c.text.secondary} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: isAutomaticPeriod ? "#fff" : c.text.primary }}>
                        {t("Automático")}
                    </Text>
                </Button>
                <Button
                    variant={!isAutomaticPeriod ? "primary" : "outline"}
                    size="sm"
                    onPress={() => onModeChange(false)}
                    style={{ minWidth: 120 }}
                >
                    <Feather name="edit-3" size={14} color={!isAutomaticPeriod ? "#fff" : c.text.secondary} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: !isAutomaticPeriod ? "#fff" : c.text.primary }}>
                        {t("Manual")}
                    </Text>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => suggestDatesRef.current?.()}
                    style={{ backgroundColor: c.brand.primaryLight }}
                >
                    <Feather name="calendar" size={14} color={c.brand.primary} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.brand.primary }}>
                        {t("Sugerir fechas")}
                    </Text>
                </Button>
            </View>

            <DateRangePicker
                startDate={periodStartDate}
                endDate={periodEndDate}
                onStartDateChange={onStartDateChange}
                onEndDateChange={onEndDateChange}
                periodType={academicPeriodType}
                onSuggestDatesRef={(fn) => { suggestDatesRef.current = fn; }}
            />

            {/* Banner estado modo */}
            <View style={{
                backgroundColor: isAutomaticPeriod ? c.status.successLight : c.status.warningLight,
                borderRadius: 14,
                padding: 12,
                flexDirection: "row",
                gap: 8,
                marginTop: 8,
            }}>
                <Feather
                    name={isAutomaticPeriod ? "info" : "alert-triangle"}
                    size={13}
                    color={isAutomaticPeriod ? c.status.success : c.status.warning}
                    style={{ marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: isAutomaticPeriod ? c.status.successDark : c.status.warningDark, marginBottom: 4 }}>
                        {isAutomaticPeriod ? t("Modo Automático Activado") : t("Modo Manual Activado")}
                    </Text>
                    <Text style={{ fontSize: 12, color: isAutomaticPeriod ? c.status.successDark : c.status.warningDark, lineHeight: 18 }}>
                        {isAutomaticPeriod
                            ? t("Al finalizar el período actual, el sistema calculará automáticamente las fechas del próximo período basándose en la duración del actual y actualizará la configuración.")
                            : t("Al finalizar el período actual, recibirás una alerta para que configures manualmente las fechas del nuevo período. El sistema NO actualizará las fechas automáticamente.")}
                    </Text>
                </View>
            </View>

            {/* Modal informativo */}
            <InfoModal
                visible={showInfoModal}
                onClose={() => setShowInfoModal(false)}
                title={t("Período detectado por división del año")}
                icon="calendar"
            >
                <View style={{ gap: 12 }}>
                    {automaticPeriod && (
                        <View>
                            <Text style={{ fontSize: 15, fontWeight: "600", color: c.brand.primary, marginBottom: 8 }}>
                                {getFullPeriodLabel(automaticPeriod)}
                            </Text>
                            <Text style={{ fontSize: 14, color: c.text.primary, lineHeight: 20 }}>
                                {t("Este cálculo se basa en dividir el año calendario según el tipo de período seleccionado.")}
                            </Text>
                        </View>
                    )}
                    
                    {/* Separador */}
                    <View style={{ height: 1, backgroundColor: c.border.light, marginVertical: 4 }} />
                    
                    {/* Información sobre limpieza de horarios */}
                    <View style={{
                        backgroundColor: c.status.warningLight,
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: c.status.warningBorder || c.status.warning + '20',
                    }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                            <View style={{
                                backgroundColor: c.status.warning,
                                borderRadius: 18,
                                width: 28,
                                height: 28,
                                alignItems: "center",
                                justifyContent: "center",
                                marginTop: 1,
                            }}>
                                <Feather name="alert-circle" size={16} color="#fff" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ 
                                    fontSize: 16, 
                                    fontWeight: "700", 
                                    color: c.status.warningDark,
                                    marginBottom: 6,
                                    letterSpacing: -0.2,
                                }}>
                                    {t("Limpieza automática de horarios")}
                                </Text>
                                <Text style={{ 
                                    fontSize: 14, 
                                    color: c.status.warningDark, 
                                    lineHeight: 21,
                                    opacity: 0.9,
                                }}>
                                    {t("Al finalizar el período académico, todos los horarios asignados a los ambientes se borrarán automáticamente.")}
                                </Text>
                                <Text style={{ 
                                    fontSize: 13, 
                                    color: c.status.warningDark, 
                                    lineHeight: 19,
                                    marginTop: 6,
                                    opacity: 0.8,
                                    fontStyle: "italic",
                                }}>
                                    {t("Los cursos, ambientes y registros históricos no se verán afectados.")}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </InfoModal>
        </View>
    );
}
