// ============================================================
//  FaceAttend EDU — Sanciones Section
//
//  Sección para mostrar el historial de usuarios sancionados/reportados.
//  Muestra estadísticas dinámicas y el registro histórico de sanciones.
//  Los usuarios se reportan desde la vista padre, aquí solo se visualiza el historial.
// ============================================================

import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { 
    Button, 
    Avatar,
    Badge,
    EmptyState,
    Card
} from "../../../components/common";
import { useTheme } from "../../../components/hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { useAppData } from "../../../../context/AppDataContext";
import { useDateFormat } from "../../../components/hooks/useDateFormat";
import { getAttendanceThresholds, getAtRiskStudents } from "../../../../models/data/userDerivedData";
import { getInstitutionConfig } from "../../../../core/config/institutionConfig";
import { getSanctions, getSanctionsStats } from "../../../../models/data/sanctionsData";

function SancionHistoryRow({ sancion, index, isLast }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const { formatDate } = useDateFormat();
    const c = theme.colors;
    
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                gap: 12,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: c.border.primary,
            }}
        >
            <View style={{ position: "relative" }}>
                <Avatar name={sancion.studentName} size={48} />
                <View style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: c.status.danger,
                    borderWidth: 2,
                    borderColor: c.background.surface,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <Feather 
                        name="alert-octagon" 
                        size={10} 
                        color="#fff" 
                    />
                </View>
            </View>

            <View style={{ flex: 1, gap: 6 }}>
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: c.text.primary,
                        flex: 1,
                    }} numberOfLines={1}>
                        {sancion.studentName}
                    </Text>

                    <Badge 
                        variant="danger" 
                        size="sm"
                    >
                        {sancion.attendanceRate}%
                    </Badge>
                </View>

                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                }}>
                    <Text style={{ fontSize: 12, color: c.text.secondary }}>
                        {sancion.studentCode}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.text.secondary }}>•</Text>
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                        flex: 1,
                    }} numberOfLines={1}>
                        {sancion.fichaName || sancion.ficha || "—"}
                    </Text>
                </View>

                <View style={{
                    flexDirection: "row",
                    alignItems: "center", 
                    gap: 8,
                }}>
                    <Text style={{
                        fontSize: 11,
                        color: c.text.secondary,
                        flex: 1,
                    }} numberOfLines={1}>
                        {sancion.reason}
                    </Text>
                </View>

                <Text style={{ fontSize: 11, color: c.text.disabled }}>
                    {t("Notificado el")} {formatDate(sancion.notificationDate, "DD/MM/YYYY HH:mm")}
                </Text>
            </View>

            <View style={{ alignItems: "center", gap: 4 }}>
                <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: sancion.status === "notified" ? c.status.success : c.status.warning,
                }} />
                <Text style={{ fontSize: 10, color: c.text.secondary }}>
                    {sancion.status === "notified" ? t("Notificado") : t("Pendiente")}
                </Text>
            </View>
        </View>
    );
}

export function SancionesSection() {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const appData = useAppData();
    const c = theme.colors;

    // Obtener sanciones reales desde el modelo
    const sanctions = useMemo(() => getSanctions(), []);
    
    // Obtener estudiantes en riesgo (pendientes por reportar)
    const studentsAtRisk = useMemo(() => {
        if (!appData.students || appData.students.length === 0) return [];
        
        const config = getInstitutionConfig();
        return getAtRiskStudents(appData.students, config.minAttendance);
    }, [appData.students]);

    // Estadísticas dinámicas desde el modelo
    const stats = useMemo(() => {
        const sanctionsStats = getSanctionsStats();
        const totalParaReportar = studentsAtRisk.length;

        return { 
            totalParaReportar, 
            totalReportados: sanctionsStats.total,
            sanciones: sanctionsStats.notified,
            alertas: sanctionsStats.pending
        };
    }, [studentsAtRisk, sanctions]);

    return (
        <View style={{ padding: 24, gap: 20 }}>
            {/* Estadísticas principales */}
            <View style={{
                flexDirection: "row",
                gap: 12,
            }}>
                <View style={{
                    flex: 1,
                    padding: 16,
                    backgroundColor: c.brand.primaryLight,
                    borderRadius: 12,
                    alignItems: "center",
                }}>
                    <Text style={{
                        fontSize: 28,
                        fontWeight: "700",
                        color: c.brand.primary,
                    }}>
                        {stats.totalReportados}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: c.brand.primary,
                        textAlign: "center",
                    }}>
                        {t("Total reportados")}
                    </Text>
                </View>
                
                <View style={{
                    flex: 1,
                    padding: 16,
                    backgroundColor: c.status.dangerLight,
                    borderRadius: 12,
                    alignItems: "center",
                }}>
                    <Text style={{
                        fontSize: 28,
                        fontWeight: "700",
                        color: c.status.danger,
                    }}>
                        {stats.sanciones}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: c.status.danger,
                        textAlign: "center",
                    }}>
                        {t("Sanciones")}
                    </Text>
                </View>
                
                <View style={{
                    flex: 1,
                    padding: 16,
                    backgroundColor: c.status.warningLight,
                    borderRadius: 12,
                    alignItems: "center",
                }}>
                    <Text style={{
                        fontSize: 28,
                        fontWeight: "700",
                        color: c.status.warning,
                    }}>
                        {stats.alertas}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: c.status.warning,
                        textAlign: "center",
                    }}>
                        {t("Alertas")}
                    </Text>
                </View>
            </View>

            {/* Historial de sanciones */}
            <Card padding={0}>
                {sanctions.length === 0 ? (
                    <EmptyState
                        icon="file-text"
                        title={t("Sin historial de sanciones")}
                        description={t("No hay estudiantes reportados o sancionados en el sistema")}
                    />
                ) : (
                    <>
                        <View style={{
                            padding: 16,
                            borderBottomWidth: 1,
                            borderBottomColor: c.border.primary,
                            backgroundColor: c.background.surfaceVariant,
                        }}>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: c.text.primary,
                                marginBottom: 4,
                            }}>
                                {t("Historial de Reportes y Sanciones")}
                            </Text>
                            <Text style={{
                                fontSize: 12,
                                color: c.text.secondary,
                            }}>
                                {stats.totalReportados} {stats.totalReportados === 1 ? t("estudiante reportado") : t("estudiantes reportados")}
                            </Text>
                        </View>

                        <ScrollView style={{ maxHeight: 600 }}>
                            {sanctions.map((sancion, index) => (
                                <SancionHistoryRow
                                    key={sancion.id}
                                    sancion={sancion}
                                    index={index}
                                    isLast={index === sanctions.length - 1}
                                />
                            ))}
                        </ScrollView>
                    </>
                )}
            </Card>

            {/* Información adicional */}
            <View style={{
                padding: 16,
                backgroundColor: c.background.surfaceVariant,
                borderRadius: 12,
                gap: 8,
            }}>
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                }}>
                    <Feather name="info" size={16} color={c.brand.primary} />
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: c.text.primary,
                    }}>
                        {t("Información sobre Sanciones")}
                    </Text>
                </View>
                
                <Text style={{
                    fontSize: 12,
                    color: c.text.secondary,
                    lineHeight: 16,
                }}>
                    • {t("Los estudiantes se reportan desde la vista principal de Reportes")}{"\n"}
                    • {t("Las sanciones se generan automáticamente según el porcentaje de asistencia")}{"\n"}
                    • {t("El historial muestra todos los reportes realizados con su estado actual")}{"\n"}
                    • {t("Los estudiantes pueden aparecer múltiples veces si son reportados en diferentes fechas")}
                </Text>
            </View>
        </View>
    );
}