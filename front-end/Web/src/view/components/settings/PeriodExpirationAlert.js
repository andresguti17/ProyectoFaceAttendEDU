// ============================================================
//  PeriodExpirationAlert — Alerta de expiración de período académico
// ============================================================
//  Muestra una alerta prominente cuando el período académico
//  ha expirado o está próximo a expirar.
//
//  Se usa especialmente en modo manual para recordar al
//  administrador que debe configurar el nuevo período.
// ============================================================

import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";

/**
 * Componente de alerta de expiración de período
 * 
 * @param {Object} props
 * @param {Object} props.expirationInfo - Información de expiración del período
 * @param {boolean} props.isAutomaticMode - Si está en modo automático
 * @param {function} props.onConfigure - Callback cuando se presiona "Configurar ahora"
 * @param {function} props.onDismiss - Callback cuando se presiona "Cerrar"
 */
export function PeriodExpirationAlert({
    expirationInfo,
    isAutomaticMode = false,
    onConfigure,
    onDismiss,
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    if (!expirationInfo) {
        return null;
    }

    // Determinar el tipo de alerta según el estado
    const getAlertConfig = () => {
        if (expirationInfo.hasExpired) {
            return {
                type: "danger",
                icon: "alert-circle",
                iconColor: c.status.danger,
                bgColor: c.status.dangerLight,
                textColor: c.status.dangerDark,
                title: t("⚠️ Período académico expirado"),
                message: isAutomaticMode
                    ? t(`El período académico finalizó hace ${expirationInfo.daysOverdue} días. En modo automático, el sistema debería haber actualizado las fechas. Verifica la configuración.`)
                    : t(`El período académico finalizó hace ${expirationInfo.daysOverdue} días. Configura las fechas del nuevo período para continuar.`),
            };
        }

        if (expirationInfo.isExpiringSoon) {
            return {
                type: "warning",
                icon: "alert-triangle",
                iconColor: c.status.warning,
                bgColor: c.status.warningLight,
                textColor: c.status.warningDark,
                title: t("⏰ Período próximo a finalizar"),
                message: isAutomaticMode
                    ? t(`El período actual finaliza en ${expirationInfo.daysRemaining} días. En modo automático, el sistema actualizará las fechas automáticamente al finalizar.`)
                    : t(`El período actual finaliza en ${expirationInfo.daysRemaining} días. Prepara las fechas del próximo período para evitar interrupciones.`),
            };
        }

        return null;
    };

    const alertConfig = getAlertConfig();

    if (!alertConfig) {
        return null;
    }

    return (
        <View
            style={{
                backgroundColor: alertConfig.bgColor,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
            }}
        >
            <View style={{ flexDirection: "row", gap: 12 }}>
                {/* Icono */}
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: alertConfig.iconColor + "20",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Feather
                        name={alertConfig.icon}
                        size={20}
                        color={alertConfig.iconColor}
                    />
                </View>

                {/* Contenido */}
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: alertConfig.textColor,
                            marginBottom: 6,
                        }}
                    >
                        {alertConfig.title}
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: alertConfig.textColor,
                            lineHeight: 18,
                            marginBottom: 12,
                        }}
                    >
                        {alertConfig.message}
                    </Text>

                    {/* Botones de acción */}
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {!isAutomaticMode && expirationInfo.hasExpired && onConfigure && (
                            <Pressable
                                onPress={onConfigure}
                                style={{
                                    backgroundColor: alertConfig.iconColor,
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Feather name="settings" size={14} color="#fff" />
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: "#fff",
                                    }}
                                >
                                    {t("Configurar nuevo período")}
                                </Text>
                            </Pressable>
                        )}

                        {expirationInfo.isExpiringSoon && !isAutomaticMode && onConfigure && (
                            <Pressable
                                onPress={onConfigure}
                                style={{
                                    backgroundColor: alertConfig.iconColor,
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Feather name="calendar" size={14} color="#fff" />
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: "#fff",
                                    }}
                                >
                                    {t("Preparar siguiente período")}
                                </Text>
                            </Pressable>
                        )}

                        {onDismiss && (
                            <Pressable
                                onPress={onDismiss}
                                style={{
                                    backgroundColor: "transparent",
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    borderWidth: 1.5,
                                    borderColor: alertConfig.textColor + "40",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Feather name="x" size={14} color={alertConfig.textColor} />
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: alertConfig.textColor,
                                    }}
                                >
                                    {t("Cerrar")}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>

            {/* Información adicional para modo automático */}
            {isAutomaticMode && expirationInfo.hasExpired && (
                <View
                    style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: alertConfig.textColor + "20",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 11,
                            color: alertConfig.textColor,
                            lineHeight: 16,
                        }}
                    >
                        💡 <Text style={{ fontWeight: "600" }}>{t("Sugerencia:")}</Text>{" "}
                        {t("Si el período no se actualizó automáticamente, verifica que las fechas del período anterior estén configuradas correctamente.")}
                    </Text>
                </View>
            )}
        </View>
    );
}

export default PeriodExpirationAlert;
