// ============================================================
//  FaceAttend EDU — Signup VIEW (registro de sede + administrador)
// ============================================================
//  RESPONSABILIDAD: Presentación y UI ("cómo se presenta")
//
//  Este componente:
//  ✓ Renderiza el formulario en dos pasos (sede y administrador)
//  ✓ Maneja estilos, layouts y animaciones
//  ✓ Coordina el hook useSignupViewModel
//
//  NO debe:
//  ✗ Manejar navegación directamente
//  ✗ Conocer rutas o nombres de pantallas
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
import { AnimatedDropdown } from "./components/common";
import {
    AuthFooterLink,
    BrandPanelCircles,
    AuthCopyright,
    PasswordStrengthIndicator,
    AuthMobileLayout,
    AuthAnimatedLayout,
} from "./components/auth";
import { useSignupViewModel } from "../viewmodels/useSignupViewModel";
import { DOCUMENT_TYPES } from "../core/utils/schoolSignup";
import { useTranslation }     from "../core/utils/i18n/hooks/useTranslation";
import { useAutoSlideOnContent } from "./components/hooks/useAutoSlideOnContent";

// Espaciados centralizados del formulario
const FORM_SPACING = { fieldGap: 8 };

const DOCUMENT_ITEMS = DOCUMENT_TYPES.map((d) => ({ value: d, label: d, icon: "credit-card" }));

export default function SignupView({ onRegisterSuccess, onGoToLogin, onGoToLanding }) {
    const { isSmall } = useResponsive();
    const { theme }   = useTheme();
    const c           = theme.colors;
    const vm          = useSignupViewModel(onRegisterSuccess);
    const { t }       = useTranslation();

    // Estado para el trigger del autoSlide
    const [autoSlideTrigger, setAutoSlideTrigger] = useState(null);
    const registerAutoSlideTrigger = useCallback((callback) => {
        setAutoSlideTrigger(() => callback);
    }, []);

    // Recomendaciones de contraseña NO cumplidas: al cambiar, el scroll baja solo.
    const password = vm.values.password;
    const visibleRequirementsCount = useMemo(() => {
        if (!password) return 0;
        return [
            password.length < 8,
            !/[A-Z]/.test(password),
            !/[a-z]/.test(password),
            !/[0-9]/.test(password),
            !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
        ].filter(Boolean).length;
    }, [password]);

    useAutoSlideOnContent(visibleRequirementsCount, autoSlideTrigger, {
        triggerOnAnyChange: true,
        delay: 150,
    });

    const handleKeyPress = (e) => {
        if (e.nativeEvent.key === "Enter" && !vm.loading) vm.handleRegister();
    };

    // Propiedades comunes de un TextInput del formulario.
    const field = (name, extra = {}) => ({
        value: vm.values[name],
        onChangeText: (text) => vm.setValue(name, text),
        onBlur: () => vm.handleBlur(name),
        onKeyPress: handleKeyPress,
        error: !!vm.errors[name],
        errorMessage: vm.errors[name],
        success: vm.isValid(name),
        shake: !!vm.shakeFields[name],
        ...extra,
    });

    const icon = (name) => <Feather name={name} size={20} color={c.text.secondary} />;

    const passwordToggle = (
        <TouchableOpacity onPress={vm.togglePassword}>
            <Feather name={vm.showPassword ? "eye-off" : "eye"} size={20} color={c.text.secondary} />
        </TouchableOpacity>
    );

    // ── Paso 1: sede ──────────────────────────────────────────
    const schoolFields = (
        <View style={{ gap: FORM_SPACING.fieldGap }}>
            <TextInput label={t("Código de la sede")} placeholder={t("CIES-001")}
                leftIcon={icon("hash")} autoCapitalize="characters" {...field("code")} />
            <TextInput label={t("Nombre de la sede")} placeholder={t("Nombre de la institución")}
                leftIcon={icon("home")} {...field("name")} />
            <TextInput label={t("Ciudad")} placeholder={t("Ciudad donde funciona la sede")}
                leftIcon={icon("map-pin")} {...field("cityName")} />
            <TextInput label={t("Dirección (opcional)")} placeholder={t("Calle, número, barrio")}
                leftIcon={icon("navigation")} {...field("address")} />
            <TextInput label={t("Teléfono de la sede (opcional)")} placeholder={t("300 000 0000")}
                type="phone" leftIcon={icon("phone")} {...field("phone")} />
            <TextInput label={t("Correo de la sede (opcional)")} placeholder={t("contacto@institucion.edu")}
                type="email" leftIcon={icon("mail")} {...field("email")} />
        </View>
    );

    // ── Paso 2: administrador ─────────────────────────────────
    const adminFields = (
        <View style={{ gap: FORM_SPACING.fieldGap }}>
            <View>
                <AnimatedDropdown
                    label={t("Tipo de documento")}
                    items={DOCUMENT_ITEMS}
                    value={vm.values.documentType}
                    onSelect={(v) => vm.setValue("documentType", v)}
                    placeholder={t("Seleccionar tipo")}
                    error={!!vm.errors.documentType}
                    triggerHeight={48}
                />
                {!!vm.errors.documentType && (
                    <Text style={{ color: c.status?.error ?? "#DC2626", fontSize: 12, marginTop: 4 }}>
                        {vm.errors.documentType}
                    </Text>
                )}
            </View>
            <TextInput label={t("Número de documento")} placeholder={t("Número sin puntos")}
                leftIcon={icon("credit-card")} {...field("documentNumber")} />
            <TextInput label={t("Nombres")} placeholder={t("Nombres del administrador")}
                leftIcon={icon("user")} {...field("adminName")} />
            <TextInput label={t("Apellidos")} placeholder={t("Apellidos del administrador")}
                leftIcon={icon("user")} {...field("adminLastName")} />
            <TextInput label={t("Correo electrónico")} placeholder={t("correo@universidad.edu")}
                type="email" leftIcon={icon("mail")} {...field("adminEmail")} />
            <TextInput label={t("Teléfono (opcional)")} placeholder={t("300 000 0000")}
                type="phone" leftIcon={icon("phone")} {...field("adminPhone")} />
            <TextInput label={t("Usuario")} placeholder={t("Tu nombre de usuario")}
                leftIcon={icon("at-sign")} {...field("username")} />
            <View>
                <TextInput label={t("Contraseña")} placeholder={t("Crea una contraseña")}
                    type="password" secureTextEntry={!vm.showPassword}
                    leftIcon={icon("lock")} rightIcon={passwordToggle} {...field("password")} />
                <PasswordStrengthIndicator password={password} show={password.length > 0} />
            </View>
            <TextInput label={t("Confirmar contraseña")} placeholder={t("Repite la contraseña")}
                type="password" secureTextEntry={!vm.showPassword}
                leftIcon={icon("lock")} {...field("confirmPassword")} />
        </View>
    );

    const fields = (
        <View style={{ gap: FORM_SPACING.fieldGap }}>
            {vm.step === 1 ? schoolFields : adminFields}
            {!!vm.submitError && <Alert type="error" message={vm.submitError} />}
        </View>
    );

    // Indicador de progreso: "Paso 1 de 2" + dos barras.
    const stepHeader = (
        <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.text.secondary, marginBottom: 6 }}>
                {t("Paso")} {vm.step} {t("de")} {vm.totalSteps} · {vm.step === 1 ? t("Datos de la sede") : t("Administrador de la sede")}
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
                {[1, 2].map((n) => (
                    <View key={n} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        backgroundColor: n <= vm.step ? c.brand?.primary ?? c.text.primary : c.border?.default ?? "#D1D5DB",
                    }} />
                ))}
            </View>
        </View>
    );

    const formActions = (
        <React.Fragment>
            <View style={{ marginTop: 20, gap: 10 }}>
                <Button onPress={vm.handleRegister} disabled={vm.loading} loading={vm.loading}>
                    {vm.step === 1
                        ? t("Continuar")
                        : vm.loading ? t("Registrando…") : t("Registrar sede")}
                </Button>
                {vm.step === 2 && (
                    <Button variant="outline" onPress={vm.goBack} disabled={vm.loading}>
                        {t("Atrás")}
                    </Button>
                )}
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

    // ── Éxito: la sede y el administrador quedan pendientes de activación ──
    const successContent = (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 14 }}>
            <Feather name="check-circle" size={56} color={c.status?.success ?? "#16A34A"} />
            <Text style={{ fontSize: 24, fontWeight: "800", color: c.text.primary, textAlign: "center" }}>
                {t("Solicitud recibida")}
            </Text>
            <Text style={{ fontSize: 15, color: c.text.secondary, textAlign: "center", lineHeight: 22 }}>
                {t("Registramos tu sede y a su administrador. Un Super Administrador debe activarlos antes de que puedas iniciar sesión.")}
            </Text>
            <View style={{ alignSelf: "stretch", marginTop: 8 }}>
                <Button onPress={onGoToLogin}>{t("Ir a iniciar sesión")}</Button>
            </View>
        </View>
    );

    // ── MÓVIL ─────────────────────────────────────────────────
    if (isSmall) {
        return (
            <AuthMobileLayout
                title={vm.done ? t("Solicitud recibida") : t("Registrar sede")}
                subtitle={vm.done ? "" : t("Completa los datos de la sede y de su administrador.")}
            >
                {vm.done ? successContent : (
                    <React.Fragment>
                        {stepHeader}
                        {fields}
                        {formActions}
                    </React.Fragment>
                )}
            </AuthMobileLayout>
        );
    }

    // ── DESKTOP — split panel con animaciones de entrada ──────
    const brandPanel = (
        <React.Fragment>
            <BrandPanelCircles />

            {onGoToLanding && (
                <TouchableOpacity
                    onPress={onGoToLanding}
                    style={{
                        position: "absolute", top: 20, left: 32, flexDirection: "row",
                        alignItems: "center", gap: 8, zIndex: 10,
                    }}
                >
                    <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.9)" />
                    <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", fontWeight: "500" }}>
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
                    fontSize: 24, fontWeight: "800", color: c.text.onBrand,
                    textAlign: "center", marginBottom: 12, letterSpacing: -0.5,
                }}>
                    {t("Registra tu institución en FaceAttend EDU")}
                </Text>
                <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 22 }}>
                    {t("Da de alta tu sede y a su administrador para llevar la asistencia con reconocimiento facial.")}
                </Text>
            </View>
        </React.Fragment>
    );

    const formContent = vm.done ? (
        <View style={{ width: "100%", minHeight: 600, justifyContent: "center" }}>{successContent}</View>
    ) : (
        <View style={{ width: "100%", minHeight: 600, justifyContent: "center", paddingTop: 35 }}>
            <View style={{ marginBottom: 14 }}>
                <Text style={{
                    fontSize: 28, fontWeight: "800", color: c.text.primary,
                    marginBottom: 6, letterSpacing: -0.5,
                }}>
                    {t("Registrar sede")}
                </Text>
                <Text style={{ fontSize: 15, color: c.text.secondary, lineHeight: 20 }}>
                    {t("Completa los datos de la sede y de su administrador.")}
                </Text>
            </View>

            {stepHeader}

            {/* Altura fija con scroll interno: el botón no se mueve entre pasos */}
            <View style={{ height: 300 }}>
                <CustomScrollBar
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ paddingVertical: 0 }}
                    bounces={false}
                    scrollbarStyle={{ variant: "pill" }}
                    effects={{
                        autoSlide: {
                            enabled: true,
                            target: "end",
                            triggerDelay: 150,
                            trigger: registerAutoSlideTrigger,
                        },
                        smoothElastic: { enabled: true, tension: 45, friction: 9 },
                    }}
                >
                    {fields}
                </CustomScrollBar>
            </View>

            <View style={{ marginTop: -8 }}>
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
