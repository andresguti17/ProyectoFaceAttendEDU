// ============================================================
//  FaceAttend EDU — Signup VIEW
// ============================================================
//  RESPONSABILIDAD: Presentación y UI ("cómo se presenta")
//
//  Este componente:
//  ✓ Renderiza toda la interfaz visual
//  ✓ Maneja estilos, layouts y animaciones
//  ✓ Coordina hooks de presentación (useSignupViewModel)
//  ✓ Gestiona el estado visual (mostrar/ocultar contraseña, etc.)
//
//  NO debe:
//  ✗ Manejar navegación directamente
//  ✗ Conocer rutas o nombres de pantallas
//  ✗ Acceder a navigation directamente
//
//  Recibe callbacks del Screen para delegar acciones de navegación.
// ============================================================

import React, { useState, useMemo, useCallback } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useResponsive }  from "./components/hooks/useResponsive";
import { useTheme }       from "./components/hooks/useTheme";
import Button             from "./components/common/buttons/Button";
import TextInput          from "./components/common/inputs/TextInput";
import Alert              from "./components/common/feedback/Alert";
import CustomScrollBar    from "./components/common/CustomScrollBar";
import {
    AuthFooterLink,
    BrandPanelCircles,
    AuthCopyright,
    PasswordStrengthIndicator,
    AuthMobileLayout,
    AuthAnimatedLayout,
} from "./components/auth";
import { useSignupViewModel } from "../viewmodels/useAuthViewModel";
import { useTranslation }     from "../core/utils/i18n/hooks/useTranslation";
import { useAutoSlideOnContent } from "./components/hooks/useAutoSlideOnContent";
import { titleCase } from "../core/utils/formatting";

/**
 * Filtra el texto para permitir solo letras y espacios manteniendo acentos
 */
const filterLettersAndSpaces = (text) => {
    if (!text) return '';
    // Permite letras con acentos, espacios, ñ, ü, etc.
    return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑç\s]/g, '');
};

/**
 * Formatea el nombre: filtra caracteres no válidos y capitaliza usando titleCase
 */
const formatName = (text) => {
    if (!text) return '';
    const filtered = filterLettersAndSpaces(text);
    return titleCase(filtered);
};


export default function SignupView({ onRegisterSuccess, onGoToLogin, onGoToLanding }) {
    const { isSmall } = useResponsive();
    const { theme }   = useTheme();
    const c           = theme.colors;
    const vm          = useSignupViewModel(onRegisterSuccess);
    const { t }       = useTranslation();
    
    // Estado para el trigger del autoSlide
    const [autoSlideTrigger, setAutoSlideTrigger] = useState(null);
    
    // Callback estable para registrar el trigger del CustomScrollBar
    const registerAutoSlideTrigger = useCallback((callback) => {
        setAutoSlideTrigger(() => callback);
    }, []);

    // ── Secciones compartidas entre mobile y desktop ──────────
    // Detectar si debe mostrarse el indicador de contraseña
    const showPasswordIndicator = vm.password.length > 0;
    
    // Calcular la cantidad de recomendaciones NO cumplidas (visibles)
    const visibleRequirementsCount = useMemo(() => {
        if (!vm.password) return 0;
        
        const requirements = [
            vm.password.length < 8,                                      // Mínimo 8 caracteres
            !/[A-Z]/.test(vm.password),                                  // 1 mayúscula
            !/[a-z]/.test(vm.password),                                  // 1 minúscula
            !/[0-9]/.test(vm.password),                                  // 1 número
            !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(vm.password), // 1 carácter especial
        ];
        
        // Contar cuántos NO están cumplidos (son true)
        return requirements.filter(Boolean).length;
    }, [vm.password]);
    
    // Hook que detecta cuando aparecen o cambian las recomendaciones y dispara autoslide
    // CLAVE: triggerOnAnyChange = true para que dispare SIEMPRE que cambie el count
    useAutoSlideOnContent(
        visibleRequirementsCount,
        autoSlideTrigger,
        { 
            triggerOnAnyChange: true,  // Disparar en CUALQUIER cambio de recomendaciones
            delay: 150,                // Pequeño delay para que la animación sea suave
        }
    );
    
    // Handler para cuando el usuario cambie el nombre de usuario (con formateo)
    const handleUsernameChange = (text) => {
        const formatted = formatName(text);
        vm.setUsername(formatted);
    };
    
    // Handler para cuando el usuario cambie la contraseña
    const handlePasswordChange = (text) => {
        vm.setPassword(text);
    };
    
    // Handler para envío con Enter
    const handleKeyPress = (e) => {
        if (e.nativeEvent.key === 'Enter' && !vm.loading) {
            vm.handleRegister();
        }
    };
    
    // Espaciados centralizados del formulario
    const FORM_SPACING = {
        fieldGap: 8,              // Gap entre campos del formulario
        errorMarginTop: -5,         // Margen entre campo y mensaje de error
    };
    
    const fields = (
        <View style={{ gap: FORM_SPACING.fieldGap }}>
            <TextInput
                label={t("Usuario")}
                placeholder={t("Tu nombre de usuario")}
                value={vm.username}
                onChangeText={handleUsernameChange}
                onBlur={() => vm.handleBlur('username')}
                onKeyPress={handleKeyPress}
                leftIcon={<Feather name="user" size={20} color={c.text.secondary} />}
                error={!!vm.usernameError}
                errorMessage={vm.usernameError}
                success={vm.usernameValid && !vm.usernameError}
                shake={vm.shakeFields.username}
            />
            <TextInput
                label={t("Correo electrónico")}
                placeholder={t("correo@universidad.edu")}
                value={vm.email}
                onChangeText={vm.setEmail}
                onBlur={() => vm.handleBlur('email')}
                onKeyPress={handleKeyPress}
                type="email"
                leftIcon={<Feather name="mail" size={20} color={c.text.secondary} />}
                error={!!vm.emailError}
                errorMessage={vm.emailError}
                success={vm.emailValid && !vm.emailError}
                shake={vm.shakeFields.email}
            />
            <View>
                <TextInput
                    label={t("Contraseña")}
                    placeholder={t("Crea una contraseña")}
                    value={vm.password}
                    onChangeText={handlePasswordChange}
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
                    error={!!vm.passwordError && vm.password.length === 0}
                    errorMessage={vm.password.length === 0 ? vm.passwordError : null}
                    success={vm.passwordValid && !vm.passwordError}
                    shake={vm.shakeFields.password}
                />
                {/* Indicador siempre visible cuando hay contraseña */}
                <PasswordStrengthIndicator 
                    password={vm.password} 
                    show={showPasswordIndicator}
                />
            </View>
        </View>
    );

    const formActions = (
        <React.Fragment>
            <View style={{ marginTop: 20 }}>
                <Button
                    onPress={vm.handleRegister}
                    disabled={vm.loading}
                    loading={vm.loading}
                >
                    {vm.loading ? t("Registrando…") : t("Registrarse")}
                </Button>
            </View>
            <View style={{ marginTop: 16 }}>
                <AuthFooterLink
                    prompt={t("¿Ya tienes cuenta?")}
                    linkLabel={t("Inicia sesión")}
                    onPress={onGoToLogin}
                />
            </View>
            <View style={{ marginTop: 12 }}>
                <AuthCopyright />
            </View>
        </React.Fragment>
    );

    // ── MÓVIL ─────────────────────────────────────────────────
    if (isSmall) {
        return (
            <AuthMobileLayout
                title={t("Crear cuenta")}
                subtitle={t("Completa los datos para registrarte.")}
            >
                {fields}
                {formActions}
            </AuthMobileLayout>
        );
    }

    // ── DESKTOP — split panel con animaciones de entrada ──────
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
            
            <View style={{ zIndex: 1, alignItems: "center", maxWidth: 440, paddingHorizontal: 32 }}>
                <Image
                    source={require("../assets/images/logoFaceAttend.svg")}
                    style={{ width: 250, height: 100, marginBottom: 32 }}
                    resizeMode="contain"
                />
                <Text style={{
                    fontSize: 24,
                    fontWeight: "800",
                    color: c.text.onBrand,
                    textAlign: "center",
                    marginBottom: 12,
                    letterSpacing: -0.5,
                }}>
                    {t("Únete a FaceAttend EDU")}
                </Text>
                <Text style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.85)",
                    textAlign: "center",
                    lineHeight: 22,
                }}>
                    {t("Registrate para que puedas aplicar al sistema de registro de asistencias con reconocimiento facial del mañana.")}
                </Text>
            </View>
        </React.Fragment>
    );

    const formContent = (
        <View style={{ width: '100%', minHeight: 600, justifyContent: 'center', paddingTop: 35 }}>
            {/* Header - compacto */}
            <View style={{ marginBottom: 18 }}>
                <Text style={{
                    fontSize: 28,
                    fontWeight: "800",
                    color: c.text.primary,
                    marginBottom: 6,
                    letterSpacing: -0.5,
                }}>
                    {t("Crear cuenta")}
                </Text>
                <Text style={{
                    fontSize: 15,
                    color: c.text.secondary,
                    lineHeight: 16,
                }}>
                    {t("Completa los datos para registrarte.")}
                </Text>
            </View>

            {/* Campos del formulario - ALTURA FIJA para que no mueva nada */}
            <View style={{ height: 270, marginTop: -5}}>
                <CustomScrollBar
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ 
                        paddingVertical: 0,
                    }}
                    bounces={false}
                    scrollbarStyle={{
                        variant: 'pill',
                    }}
                    effects={{
                        autoSlide: {
                            enabled: true,
                            target: 'end',
                            triggerDelay: 150,
                            trigger: registerAutoSlideTrigger,
                        },
                        smoothElastic: {
                            enabled: true,
                            tension: 45,
                            friction: 9,
                        },
                    }}
                >
                    {fields}
                </CustomScrollBar>
            </View>

            {/* Botón y footer - compacto, cerca del formulario */}
            <View style={{ marginTop: -18}}>
                {formActions}
            </View>
        </View>
    );

    return (
        <AuthAnimatedLayout
            screenKey="register"
            brandPanel={brandPanel}
            formContent={formContent}
        />
    );
}
