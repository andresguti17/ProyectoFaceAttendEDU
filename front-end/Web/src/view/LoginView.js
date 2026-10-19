// ============================================================
//  FaceAttend EDU — Login VIEW
// ============================================================
//  RESPONSABILIDAD: Presentación y UI ("cómo se presenta")
//
//  Este componente:
//  ✓ Renderiza toda la interfaz visual
//  ✓ Maneja estilos, layouts y animaciones
//  ✓ Coordina hooks de presentación (useLoginViewModel)
//  ✓ Gestiona el estado visual (mostrar/ocultar contraseña, etc.)
//
//  NO debe:
//  ✗ Manejar navegación directamente
//  ✗ Conocer rutas o nombres de pantallas
//  ✗ Acceder a navigation directamente
//
//  Recibe callbacks del Screen para delegar acciones de navegación.
// ============================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useResponsive }  from "./components/hooks/useResponsive";
import { useTheme }       from "./components/hooks/useTheme";
import Button             from "./components/common/buttons/Button";
import TextInput          from "./components/common/inputs/TextInput";
import CustomScrollBar    from "./components/common/CustomScrollBar";
import {
    AuthFooterLink,
    BrandPanelCircles,
    AuthCopyright,
    PasswordPolicyModal,
    AuthMobileLayout,
    AuthAnimatedLayout,
} from "./components/auth";
import { useLoginViewModel } from "../viewmodels/useAuthViewModel";
import { useTranslation }    from "../core/utils/i18n/hooks/useTranslation";


export default function LoginView({
    onLoginSuccess,
    onForgotPassword,
    onGoToRegister,
    onGoToLanding,
}) {
    const { isSmall } = useResponsive();
    const { theme }   = useTheme();
    const c           = theme.colors;
    const vm          = useLoginViewModel(onLoginSuccess);
    const { t }       = useTranslation();
    
    const [showPasswordPolicy, setShowPasswordPolicy] = useState(false);

    const FEATURES = [
        { title: t("Reconocimiento facial en tiempo real"), desc: t("Registra asistencia automáticamente con IA.")  },
        { title: t("Reportes y estadísticas detalladas"),   desc: t("Analiza patrones de asistencia por curso.")   },
        { title: t("Gestión completa de estudiantes"),      desc: t("Centraliza toda la información académica.")   },
    ];

    // Espaciados centralizados del formulario
    const FORM_SPACING = {
        fieldGap: 10,              // Gap entre campos del formulario
        errorMarginTop: 3,         // Margen entre campo y mensaje de error
    };
    
    // Handler para envío con Enter
    const handleKeyPress = (e) => {
        if (e.nativeEvent.key === 'Enter' && !vm.loading) {
            vm.handleLogin();
        }
    };

    const fields = (
        <View style={{ gap: FORM_SPACING.fieldGap }}>
            <TextInput
                label={t("Correo electrónico")}
                placeholder={t("correo@universidad.edu")}
                value={vm.emailDisplay}
                onChangeText={vm.setEmail}
                onBlur={() => vm.handleBlur('email')}
                onKeyPress={handleKeyPress}
                type="email"
                leftIcon={<Feather name="mail" size={20} color={c.text.secondary} />}
                error={!!vm.emailError}
                errorMessage={vm.emailError}
                success={vm.emailValid && !vm.emailError}
                progress={vm.emailProgress}
                shake={vm.shakeFields.email}
            />
            <View>
                <TextInput
                    label={t("Contraseña")}
                    placeholder={t("Tu contraseña")}
                    value={vm.password}
                    onChangeText={vm.setPassword}
                    onBlur={() => vm.handleBlur('password')}
                    onKeyPress={handleKeyPress}
                    type="password"
                    leftIcon={<Feather name="lock" size={20} color={c.text.secondary} />}
                    rightIcon={
                        <TouchableOpacity onPress={vm.togglePassword}>
                            <Feather name={vm.showPassword ? "eye-off" : "eye"} size={20} color={c.text.secondary} />
                        </TouchableOpacity>
                    }
                    secureTextEntry={!vm.showPassword}
                    error={!!vm.passwordError}
                    errorMessage={vm.passwordError}
                    warning={vm.passwordWarning}
                    success={vm.passwordValid && !vm.passwordError && !vm.passwordWarning}
                    progress={vm.passwordProgress}
                    shake={vm.shakeFields.password}
                />
                {/* "¿Olvidaste tu contraseña?" con distancia fija */}
                <TouchableOpacity
                    onPress={() => setShowPasswordPolicy(true)}
                    style={{ alignSelf: "flex-end", marginTop: 10 }}
                >
                    <Text style={{ fontSize: 14, color: c.brand.primary, fontWeight: "500" }}>
                        {t("¿Olvidaste tu contraseña?")}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const formActions = (
        <React.Fragment>
            <View style={{ marginTop: 20 }}>
                <Button
                    onPress={vm.handleLogin}
                    disabled={vm.loading}
                    loading={vm.loading}
                >
                    {vm.loading ? t("Ingresando…") : t("Ingresar")}
                </Button>
            </View>
            <View style={{ marginTop: 16 }}>
                <AuthFooterLink
                    prompt={t("¿No tienes cuenta?")}
                    linkLabel={t("Regístrate aquí")}
                    onPress={onGoToRegister}
                />
            </View>
            <View style={{ marginTop: 12 }}>
                <AuthCopyright />
            </View>
            
            {/* Modal de políticas de contraseña */}
            <PasswordPolicyModal
                visible={showPasswordPolicy}
                onClose={() => setShowPasswordPolicy(false)}
                onResetPassword={onForgotPassword}
            />
        </React.Fragment>
    );

    if (isSmall) {
        return (
            <AuthMobileLayout
                title={t("Inicio de sesión")}
                subtitle={t("Bienvenido de vuelta. Ingresa tus credenciales.")}
            >
                {fields}
                {formActions}
            </AuthMobileLayout>
        );
    }

    const brandPanel = (
        <React.Fragment>
            <BrandPanelCircles />
            
            {/* Botón de volver al inicio - posicionado arriba a la izquierda */}
            {onGoToLanding && (
                <TouchableOpacity
                    onPress={onGoToLanding}
                    style={{
                        position: "absolute",
                        top: 20,
                        left: 32,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        zIndex: 10,
                    }}
                >
                    <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.9)" />
                    <Text style={{
                        fontSize: 15,
                        color: "rgba(255,255,255,0.9)",
                        fontWeight: "500",
                    }}>
                        {t("Volver al inicio")}
                    </Text>
                </TouchableOpacity>
            )}
            
            <View style={{ zIndex: 1, alignItems: "center", maxWidth: 480, paddingHorizontal: 32 }}>
                <Image
                    source={require("../assets/images/logoFaceAttend.svg")}
                    style={{ width: 250, height: 100, marginBottom: 32 }}
                    resizeMode="contain"
                />
                <Text style={{
                    fontSize: 28,
                    fontWeight: "800",
                    color: c.text.onBrand,
                    textAlign: "center",
                    marginBottom: 16,
                    letterSpacing: -0.5,
                }}>
                    FaceAttend EDU
                </Text>
                <Text style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.85)",
                    textAlign: "center",
                    lineHeight: 24,
                    marginBottom: 32,
                }}>
                    {t("Asistencia inteligente para tu institución")}
                </Text>
                <View style={{ gap: 16, width: "100%" }}>
                    {FEATURES.map(f => (
                        <View key={f.title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: "rgba(255,255,255,0.7)",
                                marginTop: 6,
                                flexShrink: 0,
                            }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: "600", color: c.text.onBrand }}>{f.title}</Text>
                                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{f.desc}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </React.Fragment>
    );

    const formContent = (
        <View style={{ width: '100%', minHeight: 600, justifyContent: 'center', paddingTop: 60 }}>
            {/* Header - compacto */}
            <View style={{ marginBottom: 18 }}>
                <Text style={{
                    fontSize: 28,
                    fontWeight: "800",
                    color: c.text.primary,
                    marginBottom: 6,
                    letterSpacing: -0.5,
                }}>
                    {t("Inicio de sesión")}
                </Text>
                <Text style={{
                    fontSize: 15,
                    color: c.text.secondary,
                    lineHeight: 22,
                }}>
                    {t("Bienvenido de vuelta. Ingresa tus credenciales.")}
                </Text>
            </View>

            {/* Campos del formulario - ALTURA FIJA para que no mueva nada */}
            <View style={{ height: 235}}>
                <CustomScrollBar
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ 
                        paddingVertical: 4,
                    }}
                    bounces={false}
                    scrollbarStyle={{
                        variant: 'pill',
                    }}
                    effects={{
                        smoothElastic: {
                            enabled: true,
                            tension: 45,
                            friction: 9,
                        },
                        progressIndicator: {
                            enabled: true,
                            position: 'right',
                            color: c.brand.primary,
                            thickness: 2,
                        },
                    }}
                >
                    {fields}
                </CustomScrollBar>
            </View>

            {/* Botón y footer - compacto, cerca del formulario */}
            <View style={{ marginTop: -18 }}>
                {formActions}
            </View>
        </View>
    );

    return (
        <AuthAnimatedLayout
            screenKey="login"
            brandPanel={brandPanel}
            formContent={formContent}
        />
    );
}
