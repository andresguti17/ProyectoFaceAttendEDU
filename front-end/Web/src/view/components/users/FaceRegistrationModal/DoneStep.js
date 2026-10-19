// ============================================================
//  FaceAttend EDU — DoneStep
//  Resultado final del registro facial
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useDateFormat } from "../../hooks/useDateFormat";

export default function DoneStep({ c, t, descriptor, onDownload, onConfirm }) {
    const hasRealDesc = descriptor?.descriptor?.length === 128;
    const { formatDateTime } = useDateFormat();

    return (
        <View style={{ padding: 24 }}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
                <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 14,
                    backgroundColor: c.status.successLight,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                }}>
                    <Feather name="check-circle" size={32} color={c.status.success} />
                </View>
                <Text style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: c.text.primary,
                    marginBottom: 4,
                }}>
                    {t("Descriptor generado")}
                </Text>
                <Text style={{
                    fontSize: 11,
                    color: c.text.secondary,
                    textAlign: "center",
                }}>
                    {t("El descriptor facial está listo para enviarse al backend")}
                </Text>
            </View>

            <View style={{
                backgroundColor: c.background.app,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: c.border.primary,
                marginBottom: 16,
            }}>
                {[
                    { label: t("Estudiante:"), value: descriptor.studentName },
                    { label: "ID:", value: descriptor.studentId },
                    { label: t("Capturado:"), value: formatDateTime(new Date(descriptor.timestamp)) },
                    { label: t("Dimensiones:"), value: hasRealDesc ? "128D — face-api.js real" : "—" },
                    { label: t("Formato:"), value: descriptor.version },
                ].map(({ label, value }) => (
                    <View key={label} style={{ flexDirection: "row", gap: 8, marginBottom: 5 }}>
                        <Text style={{ fontSize: 11, color: c.text.secondary, width: 90 }}>
                            {label}
                        </Text>
                        <Text style={{ fontSize: 11, color: c.text.primary, flex: 1 }}>
                            {value}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Badge descriptor real vs sintético */}
            <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderRadius: 14,
                marginBottom: 16,
                backgroundColor: hasRealDesc ? c.status.successLight : c.status.dangerLight,
                borderWidth: 1,
                borderColor: hasRealDesc ? c.status.success : c.status.danger,
            }}>
                <Feather
                    name={hasRealDesc ? "shield" : "alert-triangle"}
                    size={12}
                    color={hasRealDesc ? c.status.success : c.status.danger}
                />
                <Text style={{
                    fontSize: 11,
                    color: hasRealDesc ? c.status.success : c.status.danger,
                    flex: 1,
                }}>
                    {hasRealDesc
                        ? t("Descriptor real generado con face-api.js (128D)")
                        : t("Descriptor no generado — los modelos no cargaron correctamente")}
                </Text>
            </View>

            <TouchableOpacity
                onPress={onDownload}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: c.border.primary,
                    backgroundColor: c.background.app,
                    marginBottom: 16,
                }}
            >
                <Feather name="download" size={14} color={c.text.secondary} />
                <Text style={{ fontSize: 10, fontWeight: "600", color: c.text.secondary }}>
                    {t("Descargar descriptor (.json)")}
                </Text>
            </TouchableOpacity>

            <View style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 16,
            }}>
                <Feather name="shield" size={11} color={c.text.disabled} style={{ marginTop: 1 }} />
                <Text style={{
                    fontSize: 11,
                    color: c.text.disabled,
                    flex: 1,
                    lineHeight: 15,
                }}>
                    {t("La imagen original no se almacena en el sistema. Solo se envía el descriptor numérico al backend.")}
                </Text>
            </View>

            <TouchableOpacity
                onPress={onConfirm}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: c.brand.primary,
                }}
            >
                <Feather name="user-check" size={16} color="#fff" />
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
                    {t("Registrar estudiante")}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

