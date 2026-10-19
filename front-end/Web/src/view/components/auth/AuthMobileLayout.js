// ============================================================
//  FaceAttend EDU — AuthMobileLayout (View Layer)
//  Layout compartido para las pantallas de auth en MÓVIL.
//
//  Envuelve el contenido en SafeArea + KeyboardAvoiding + ScrollView
//  con el encabezado de logo estándar. Evita duplicar este bloque
//  en LoginView y SignupView.
//
//  MVVM: componente puro de View. Sin lógica de negocio.
// ============================================================

import React from "react";
import {
    View,
    Text,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";

export default function AuthMobileLayout({ title, subtitle, children }) {
    const { theme } = useTheme();
    const c = theme.colors;

    return (
        <SafeAreaProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: c.background.surface }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <ScrollView
                        contentContainerStyle={{
                            flexGrow: 1,
                            justifyContent: "center",
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                        }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Logo + nombre */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                marginBottom: 40,
                            }}
                        >
                            <Image
                                source={require("../../../assets/images/logoFaceAttend.svg")}
                                style={{ width: 48, height: 48 }}
                                resizeMode="contain"
                            />
                            <Text
                                style={{
                                    fontSize: 22,
                                    fontWeight: "700",
                                    color: c.text.primary,
                                }}
                            >
                                FaceAttend{" "}
                                <Text style={{ color: c.brand.primary }}>EDU</Text>
                            </Text>
                        </View>

                        {/* Título + subtítulo */}
                        <Text
                            style={{
                                fontSize: 28,
                                fontWeight: "800",
                                color: c.text.primary,
                                marginBottom: 12,
                                letterSpacing: -0.5,
                            }}
                        >
                            {title}
                        </Text>
                        <Text
                            style={{
                                fontSize: 16,
                                color: c.text.secondary,
                                marginBottom: 32,
                                lineHeight: 24,
                            }}
                        >
                            {subtitle}
                        </Text>

                        {children}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}
