// ============================================================
//  InfoModal — Modal informativo reutilizable
// ============================================================
//  Modal superpuesto y centrado para mostrar información
//  contextual o explicaciones de funcionalidad.
// ============================================================

import React from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { Button } from "./buttons";

/**
 * Modal informativo reutilizable
 * 
 * @param {Object} props
 * @param {boolean} props.visible - Controla si el modal está visible
 * @param {function} props.onClose - Callback al cerrar el modal
 * @param {string} props.title - Título del modal
 * @param {React.ReactNode} props.children - Contenido del modal
 * @param {string} props.icon - Nombre del icono de Feather (opcional)
 */
export function InfoModal({ 
    visible, 
    onClose, 
    title, 
    children,
    icon = "info"
}) {
    const { theme } = useTheme();
    const c = theme.colors;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            {/* Overlay oscuro */}
            <TouchableOpacity
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 20,
                }}
                activeOpacity={1}
                onPress={onClose}
            >
                {/* Contenedor del modal */}
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 16,
                        padding: 24,
                        maxWidth: 500,
                        width: "100%",
                        maxHeight: "80%",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 5,
                    }}
                >
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            marginBottom: 16,
                            paddingBottom: 16,
                            borderBottomWidth: 1,
                            borderBottomColor: c.border.primary,
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: c.brand.primaryLight,
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Feather
                                name={icon}
                                size={18}
                                color={c.brand.primary}
                            />
                        </View>
                        <Text
                            style={{
                                fontSize: 16,
                                fontWeight: "700",
                                color: c.text.primary,
                                flex: 1,
                            }}
                        >
                            {title}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: c.background.tertiary,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Feather
                                name="x"
                                size={18}
                                color={c.text.secondary}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Contenido scrolleable */}
                    <ScrollView
                        style={{
                            maxHeight: 400,
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        {children}
                    </ScrollView>

                    {/* Footer con botón de cerrar */}
                    <View style={{ marginTop: 20 }}>
                        <Button
                            variant="primary"
                            onPress={onClose}
                            style={{ width: "100%" }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: "#fff",
                                }}
                            >
                                Entendido
                            </Text>
                        </Button>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

export default InfoModal;
