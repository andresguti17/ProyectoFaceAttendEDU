// ============================================================
//  FaceAttend EDU — Export Config Modal
//
//  Modal para configurar opciones de exportación (Excel/PDF)
// ============================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal as RNModal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, AnimatedDropdown } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";

export function ExportConfigModal({ visible, onClose, onExport, selectedCount }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    const [exportFormat, setExportFormat] = useState("excel"); // "excel", "pdf", "both"
    const [exportType, setExportType] = useState("simple"); // "simple" o "detailed"

    const formatOptions = [
        {
            value: "excel",
            label: t("Excel"),
            description: t("Archivo .xlsx con datos tabulados"),
            icon: "file-text",
        },
        {
            value: "pdf",
            label: t("PDF"),
            description: t("Documento con formato de impresión"),
            icon: "file",
        },
        {
            value: "both",
            label: t("Excel y PDF"),
            description: t("Exportar ambos formatos"),
            icon: "copy",
        },
    ];

    const handleExport = () => {
        // Exportar según selección
        if (exportFormat === "excel") {
            onExport("excel", exportType);
        } else if (exportFormat === "pdf") {
            onExport("pdf", exportType);
        } else if (exportFormat === "both") {
            onExport("excel", exportType);
            onExport("pdf", exportType);
        }
    };

    return (
        <RNModal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 20,
                }}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 16,
                        width: "100%",
                        maxWidth: 480,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.25,
                        shadowRadius: 24,
                        elevation: 8,
                    }}
                >
                    {/* Header */}
                    <View style={{
                        padding: 24,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border.primary,
                    }}>
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{
                                    fontSize: 20,
                                    fontWeight: "700",
                                    color: c.text.primary,
                                    marginBottom: 4,
                                }}>
                                    {t("Configurar exportación")}
                                </Text>
                                <Text style={{
                                    fontSize: 14,
                                    color: c.text.secondary,
                                }}>
                                    {selectedCount} {selectedCount === 1 ? t("registro seleccionado") : t("registros seleccionados")}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: c.background.secondary,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Feather name="x" size={18} color={c.text.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Body */}
                    <View style={{ padding: 24, gap: 20 }}>
                        {/* Sección: Formato de exportación */}
                        <View>
                            <View style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 16,
                            }}>
                                <Text style={{
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: c.text.primary,
                                    flex: 1,
                                }}>
                                    {t("Selecciona el formato de exportación:")}
                                </Text>

                                <View style={{ width: 160 }}>
                                    <AnimatedDropdown
                                        items={formatOptions}
                                        value={exportFormat}
                                        onSelect={setExportFormat}
                                        placeholder={t("Selecciona formato")}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Sección: Tipo de exportación */}
                        <View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: c.text.primary,
                                marginBottom: 12,
                            }}>
                                {t("Tipo de exportación")}
                            </Text>

                            {/* Opciones de tipo de exportación */}
                            <View style={{
                                flexDirection: "row",
                                gap: 12,
                            }}>
                                {/* Opción Sencilla */}
                                <TouchableOpacity
                                    onPress={() => setExportType("simple")}
                                    style={{
                                        flex: 1,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        padding: 14,
                                        gap: 10,
                                        borderRadius: 8,
                                        borderWidth: 2,
                                        borderColor: exportType === "simple" ? c.brand.primary : c.border.primary,
                                        backgroundColor: exportType === "simple" ? c.brand.primary + "10" : "transparent",
                                    }}
                                >
                                    {/* Radio button */}
                                    <View style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        borderWidth: 2,
                                        borderColor: exportType === "simple" ? c.brand.primary : c.border.primary,
                                        backgroundColor: "transparent",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                        {exportType === "simple" && (
                                            <View style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 5,
                                                backgroundColor: c.brand.primary,
                                            }} />
                                        )}
                                    </View>

                                    {/* Icono */}
                                    <Feather name="list" size={18} color={exportType === "simple" ? c.brand.primary : c.text.secondary} />

                                    {/* Texto */}
                                    <View style={{ flex: 1 }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: c.text.primary,
                                            marginBottom: 2,
                                        }}>
                                            {t("Exportación sencilla")}
                                        </Text>
                                        <Text style={{
                                            fontSize: 12,
                                            color: c.text.secondary,
                                        }}>
                                            {t("Tabla resumida con datos principales")}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Opción Detallada */}
                                <TouchableOpacity
                                    onPress={() => setExportType("detailed")}
                                    style={{
                                        flex: 1,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        padding: 14,
                                        gap: 10,
                                        borderRadius: 8,
                                        borderWidth: 2,
                                        borderColor: exportType === "detailed" ? c.brand.primary : c.border.primary,
                                        backgroundColor: exportType === "detailed" ? c.brand.primary + "10" : "transparent",
                                    }}
                                >
                                    {/* Radio button */}
                                    <View style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        borderWidth: 2,
                                        borderColor: exportType === "detailed" ? c.brand.primary : c.border.primary,
                                        backgroundColor: "transparent",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                        {exportType === "detailed" && (
                                            <View style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 5,
                                                backgroundColor: c.brand.primary,
                                            }} />
                                        )}
                                    </View>

                                    {/* Icono */}
                                    <Feather name="clipboard" size={18} color={exportType === "detailed" ? c.brand.primary : c.text.secondary} />

                                    {/* Texto */}
                                    <View style={{ flex: 1 }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: c.text.primary,
                                            marginBottom: 2,
                                        }}>
                                            {t("Exportación detallada")}
                                        </Text>
                                        <Text style={{
                                            fontSize: 12,
                                            color: c.text.secondary,
                                        }}>
                                            {t("Reporte completo con estadísticas")}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={{
                        padding: 24,
                        paddingTop: 16,
                        borderTopWidth: 1,
                        borderTopColor: c.border.primary,
                        flexDirection: "row",
                        gap: 12,
                    }}>
                        <Button
                            variant="ghost"
                            onPress={onClose}
                            style={{ flex: 1 }}
                        >
                            {t("Cancelar")}
                        </Button>
                        <Button
                            variant="primary"
                            onPress={handleExport}
                            style={{ flex: 1 }}
                            leftIcon={<Feather name="download" size={16} color="#fff" />}
                        >
                            {t("Exportar")}
                        </Button>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </RNModal>
    );
}
