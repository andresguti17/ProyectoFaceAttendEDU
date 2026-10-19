import React from "react";
import { View, Image, Text, StyleSheet, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Button, BackgroundImage , Card } from "./components/common";

import CustomScrollBar from "./components/common/CustomScrollBar";
import { HeroSection, HeroMediaSection, HeroStats, HeroTitle } from "./components/hero";

import { useHeroEntrance } from "./components/hooks/useHeroEntrance";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTheme } from "./components/hooks/useTheme";
import { getTypography } from "../core/constants/typography";
import BadgePositions, { BadgePositionsMobile } from "../core/constants/badgePositions";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { DESIGN_TOKENS } from "../core/config/theme.config";
import { 
    getSectionBackground, 
    getInstitutionalImage 
} from "../core/config/landing.config";

// ── Hero Section ─────────────────────────────────────────────

function HeroContent({ fadeLeft, slideLeft, fadeRight, slideRight, onNavigate }) {
    const { sp, isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const badgePos = isSmall ? BadgePositionsMobile : BadgePositions;

    const STATS = [
        { value: "99%", label: t("Precisión") },
        { value: "<1s", label: t("Detección") },
        { value: "∞", label: t("estudiantes") },
    ];

    const BADGES = [
        { label: t("Reconociendo"), icon: "✅", delay: 0, style: badgePos.topLeft },
        { label: t("Escaneando…"), icon: "📷", delay: 0.2, style: badgePos.topRight },
        { label: t("Asistencia OK"), icon: "📋", delay: 0.4, style: badgePos.bottom },
    ];

    return (
        <View
            style={{
                flexDirection: isSmall ? "column" : "row",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: sp(isSmall ? 24 : 32),
                gap: sp(isSmall ? 80 : 100),
                width: "100%",
            }}
        >
            <HeroSection
                fadeAnim={fadeLeft}
                slideAnim={slideLeft}
                minWidth={300}
                maxWidth={600}
                gap={36}
            >
                <HeroTitle
                    title={(() => {
                        const heroText = t("Asistencia inteligente para tu institución");
                        const words = heroText.split(' ');
                        if (words.length >= 2) {
                            // title = primera palabra + salto de línea
                            return words[0] + '\n';
                        }
                        return heroText;
                    })()}
                    accent={(() => {
                        const heroText = t("Asistencia inteligente para tu institución");
                        const words = heroText.split(' ');
                        if (words.length >= 2) {
                            // accent = segunda palabra + salto de línea
                            return words[1] + '\n';
                        }
                        return '';
                    })()}
                    end={(() => {
                        const heroText = t("Asistencia inteligente para tu institución");
                        const words = heroText.split(' ');
                        if (words.length >= 3) {
                            // end = resto del texto (a partir de la tercera palabra)
                            return words.slice(2).join(' ');
                        }
                        return '';
                    })()}
                />
                <View style={{ flexDirection: "row", gap: sp(12), flexWrap: "wrap" }}>
                    <Button
                        onPress={() => onNavigate("FaceAttendEDU-Register")}
                        size="lg"
                    >
                        {t("Registrarse")}
                    </Button>
                    <Button
                        variant="outline"
                        onPress={() => onNavigate("FaceAttendEDU-Login")}
                        size="lg"
                    >
                        {t("Iniciar sesión")}
                    </Button>
                </View>
                <HeroStats stats={STATS} />
            </HeroSection>

            <HeroMediaSection
                mediaSource={getInstitutionalImage()}
                badges={BADGES}
                fadeAnim={fadeRight}
                slideAnim={slideRight}
            />
        </View>
    );
}

// ── Features Section ─────────────────────────────────────────

function FeaturesContent() {
    const { sp, fs, isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const T = getTypography(fs);

    const FEATURES = [
        {
            icon: "aperture",
            title: t("Reconocimiento facial en tiempo real"),
            desc: t("Registra asistencia automáticamente con IA. Sin listas en papel, sin errores humanos."),
        },
        {
            icon: "bar-chart-2",
            title: t("Reportes y estadísticas detalladas"),
            desc: t("Analiza patrones de asistencia por curso, semana y estudiante. Exporta en PDF o Excel."),
        },
        {
            icon: "users",
            title: t("Gestión completa de estudiantes"),
            desc: t("Centraliza toda la información académica. Detecta estudiantes en riesgo de manera proactiva."),
        },
    ];

    return (
        <View
            style={{
                paddingHorizontal: sp(isSmall ? 24 : 40),
                width: "100%",
                justifyContent: "center",
            }}
        >
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: sp(48) }}>
                <View
                    style={{
                        backgroundColor: "rgba(255,255,255,0.15)",
                        paddingHorizontal: sp(16),
                        paddingVertical: sp(6),
                        borderRadius: 20,
                        marginBottom: sp(16),
                    }}
                >
                    <Text
                        style={[
                            T.eyebrow,
                            { color: "rgba(255,255,255,0.9)", letterSpacing: 1.5 },
                        ]}
                    >
                        {t("CARACTERÍSTICAS")}
                    </Text>
                </View>
                <Text
                    style={[
                        T.heading1,
                        {
                            color: c.text.onBrand,
                            textAlign: "center",
                            maxWidth: 800,
                        },
                    ]}
                >
                    {t("Todo lo que necesitas en una sola plataforma")}
                </Text>
            </View>

            {/* Feature Cards */}
            <View
                style={{
                    flexDirection: isSmall ? "column" : "row",
                    gap: sp(24),
                    maxWidth: 1200,
                    alignSelf: "center",
                    width: "100%",
                }}
            >
                {FEATURES.map((feature, index) => (
                    <Card
                        key={index}
                        style={{
                            flex: 1,
                            backgroundColor: "rgba(255,255,255,0.12)",
                            borderRadius: sp(16),
                            padding: sp(32),
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.2)",
                        }}
                    >
                        <View
                            style={{
                                width: sp(56),
                                height: sp(56),
                                borderRadius: sp(14),
                                backgroundColor: "rgba(255,255,255,0.25)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: sp(20),
                            }}
                        >
                            <Feather name={feature.icon} size={sp(28)} color={c.text.onBrand} />
                        </View>
                        <Text
                            style={[
                                T.heading2,
                                { color: c.text.onBrand, marginBottom: sp(12) },
                            ]}
                        >
                            {feature.title}
                        </Text>
                        <Text style={[T.bodyMD, { color: "rgba(255,255,255,0.8)" }]}>
                            {feature.desc}
                        </Text>
                    </Card>
                ))}
            </View>
        </View>
    );
}

// ── Testimonials Section ─────────────────────────────────────

function TestimonialsContent() {
    const { sp, fs, isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const T = getTypography(fs);

    const TESTIMONIALS = [
        {
            quote: t("FaceAttend transformó completamente nuestra gestión de asistencia. Ahorramos horas de trabajo manual cada semana."),
            author: t("María González"),
            role: t("Coordinadora Académica"),
            institution: t("SENA - Centro Industrial"),
            rating: 5,
        },
        {
            quote: t("La precisión del reconocimiento facial es impresionante. Nunca más problemas con falsificación de asistencia."),
            author: t("Carlos Ramírez"),
            role: t("Instructor SENA"),
            institution: t("Centro de Manufactura"),
            rating: 5,
        },
        {
            quote: t("Los reportes detallados nos ayudan a identificar estudiantes en riesgo temprano. Excelente herramienta."),
            author: t("Ana Martínez"),
            role: t("Directora de Formación"),
            institution: t("SENA Regional"),
            rating: 5,
        },
    ];

    return (
        <View
            style={{
                paddingHorizontal: sp(isSmall ? 24 : 40),
                width: "100%",
                justifyContent: "center",
            }}
        >
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: sp(48) }}>
                <View
                    style={{
                        backgroundColor: c.brand.primaryLight,
                        paddingHorizontal: sp(16),
                        paddingVertical: sp(6),
                        borderRadius: 20,
                        marginBottom: sp(16),
                    }}
                >
                    <Text
                        style={[
                            T.eyebrow,
                            { color: c.brand.primary, letterSpacing: 1.5 },
                        ]}
                    >
                        {t("TESTIMONIOS")}
                    </Text>
                </View>
                <Text
                    style={[
                        T.heading1,
                        { color: c.text.primary, textAlign: "center", maxWidth: 700 },
                    ]}
                >
                    {t("Instituciones que confían en nosotros")}
                </Text>
            </View>

            {/* Testimonial Cards */}
            <View
                style={{
                    flexDirection: isSmall ? "column" : "row",
                    gap: sp(24),
                    maxWidth: 1200,
                    alignSelf: "center",
                    width: "100%",
                }}
            >
                {TESTIMONIALS.map((testimonial, index) => (
                    <Card
                        key={index}
                        style={{
                            flex: 1,
                            padding: sp(28),
                            backgroundColor: c.background.surface,
                        }}
                    >
                        {/* Rating Stars */}
                        <View
                            style={{
                                flexDirection: "row",
                                gap: sp(4),
                                marginBottom: sp(16),
                            }}
                        >
                            {[...Array(testimonial.rating)].map((_, i) => (
                                <Feather
                                    key={i}
                                    name="star"
                                    size={16}
                                    color={c.status.warning}
                                    style={{ opacity: 1 }}
                                />
                            ))}
                        </View>

                        {/* Quote */}
                        <Text
                            style={[
                                T.bodyLG,
                                {
                                    color: c.text.primary,
                                    marginBottom: sp(20),
                                    lineHeight: 26,
                                },
                            ]}
                        >
                            "{testimonial.quote}"
                        </Text>

                        {/* Author */}
                        <View>
                            <Text
                                style={[
                                    T.bodyMD,
                                    { fontWeight: "600", color: c.text.primary },
                                ]}
                            >
                                {testimonial.author}
                            </Text>
                            <Text style={[T.bodySM, { color: c.text.secondary }]}>
                                {testimonial.role}
                            </Text>
                            <Text
                                style={[
                                    T.bodySM,
                                    { color: c.text.tertiary, marginTop: sp(4) },
                                ]}
                            >
                                {testimonial.institution}
                            </Text>
                        </View>
                    </Card>
                ))}
            </View>
        </View>
    );
}

// ── CTA Section ──────────────────────────────────────────────

function CTAContent({ onNavigate }) {
    const { sp, fs, isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const T = getTypography(fs);

    return (
        <View
            style={{
                paddingHorizontal: sp(isSmall ? 24 : 40),
                width: "100%",
                justifyContent: "center",
            }}
        >
            <View
                style={{
                    maxWidth: 800,
                    alignSelf: "center",
                    alignItems: "center",
                    width: "100%",
                }}
            >
                <Text
                    style={[
                        T.displayLG,
                        {
                            color: c.text.onBrand,
                            textAlign: "center",
                            marginBottom: sp(20),
                        },
                    ]}
                >
                    {t("¿Listo para modernizar tu institución?")}
                </Text>
                <Text
                    style={[
                        T.bodyLG,
                        {
                            color: "rgba(255,255,255,0.9)",
                            textAlign: "center",
                            marginBottom: sp(32),
                            maxWidth: 600,
                        },
                    ]}
                >
                    {t("Únete a las instituciones que ya están usando FaceAttend EDU para mejorar su gestión académica.")}
                </Text>
                <View
                    style={{
                        flexDirection: isSmall ? "column" : "row",
                        gap: sp(16),
                        width: isSmall ? "100%" : "auto",
                    }}
                >
                    <Button
                        onPress={() => onNavigate("FaceAttendEDU-Register")}
                        size="lg"
                        style={{
                            backgroundColor: c.background.surface,
                            borderColor: c.background.surface,
                            borderWidth: 2,
                        }}
                        textStyle={{ color: c.brand.primary }}
                    >
                        {t("Comenzar gratis")}
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        style={{
                            borderColor: c.background.surface,
                            backgroundColor: "transparent",
                        }}
                        textStyle={{ color: c.background.surface }}
                        onPress={() => onNavigate("FaceAttendEDU-Login")}
                    >
                        {t("Ver demo")}
                    </Button>
                </View>
            </View>
        </View>
    );
}

// ── Footer ───────────────────────────────────────────────────

function Footer() {
    const { sp, fs, isSmall } = useResponsive();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const T = getTypography(fs);

    const FOOTER_LINKS = {
        product: [
            { label: t("Características"), href: "#features" },
            { label: t("Precios"), href: "#pricing" },
            { label: t("Testimonios"), href: "#testimonials" },
        ],
        company: [
            { label: t("Acerca de"), href: "#about" },
            { label: t("Blog"), href: "#blog" },
            { label: t("Contacto"), href: "#contact" },
        ],
        legal: [
            { label: t("Privacidad"), href: "#privacy" },
            { label: t("Términos"), href: "#terms" },
            { label: t("Cookies"), href: "#cookies" },
        ],
    };

    return (
        <View
            style={{
                backgroundColor: c.background.surface,
                paddingTop: sp(32),
            }}
        >
            <View
                style={{
                    maxWidth: 1200,
                    alignSelf: "center",
                    width: "100%",
                    paddingHorizontal: sp(isSmall ? 24 : 40),
                    paddingBottom: sp(isSmall ? 12 : 24),
                }}
            >
                {/* Footer Content */}
                <View
                    style={{
                        flexDirection: isSmall ? "column" : "row",
                        gap: sp(isSmall ? 24 : 40),
                        marginBottom: sp(20),
                    }}
                >
                    {/* Brand */}
                    <View style={{ flex: 1, maxWidth: isSmall ? "100%" : 300 }}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: sp(12),
                                marginBottom: sp(12),
                            }}
                        >
                            <Image
                                source={require("../assets/images/logoFaceAttend.svg")}
                                style={{ width: 40, height: 40 }}
                            />
                            <Text style={[T.brandName, { color: c.text.primary }]}>
                                FaceAttend{" "}
                                <Text style={{ color: c.brand.primary }}>EDU</Text>
                            </Text>
                        </View>
                        <Text style={[T.bodySM, { color: c.text.secondary }]}>
                            {t("Sistema inteligente de gestión de asistencia con reconocimiento facial para instituciones educativas.")}
                        </Text>
                    </View>

                    {/* Links Columns */}
                    {!isSmall && (
                        <>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        T.bodyMD,
                                        {
                                            fontWeight: "600",
                                            color: c.text.primary,
                                            marginBottom: sp(12),
                                        },
                                    ]}
                                >
                                    {t("Producto")}
                                </Text>
                                {FOOTER_LINKS.product.map((link, index) => (
                                    <Text
                                        key={index}
                                        style={[
                                            T.bodySM,
                                            {
                                                color: c.text.secondary,
                                                marginBottom: sp(6),
                                            },
                                        ]}
                                    >
                                        {link.label}
                                    </Text>
                                ))}
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        T.bodyMD,
                                        {
                                            fontWeight: "600",
                                            color: c.text.primary,
                                            marginBottom: sp(12),
                                        },
                                    ]}
                                >
                                    {t("Empresa")}
                                </Text>
                                {FOOTER_LINKS.company.map((link, index) => (
                                    <Text
                                        key={index}
                                        style={[
                                            T.bodySM,
                                            {
                                                color: c.text.secondary,
                                                marginBottom: sp(6),
                                            },
                                        ]}
                                    >
                                        {link.label}
                                    </Text>
                                ))}
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        T.bodyMD,
                                        {
                                            fontWeight: "600",
                                            color: c.text.primary,
                                            marginBottom: sp(12),
                                        },
                                    ]}
                                >
                                    {t("Legal")}
                                </Text>
                                {FOOTER_LINKS.legal.map((link, index) => (
                                    <Text
                                        key={index}
                                        style={[
                                            T.bodySM,
                                            {
                                                color: c.text.secondary,
                                                marginBottom: sp(6),
                                            },
                                        ]}
                                    >
                                        {link.label}
                                    </Text>
                                ))}
                            </View>
                        </>
                    )}
                </View>

                {/* Bottom Bar */}
                <View
                    style={{
                        paddingTop: sp(16),
                        borderTopWidth: 1,
                        borderTopColor: c.border.primary,
                        flexDirection: isSmall ? "column" : "row",
                        justifyContent: "space-between",
                        alignItems: isSmall ? "flex-start" : "center",
                        gap: sp(12),
                    }}
                >
                    <Text style={[T.caption, { color: c.text.tertiary }]}>
                        © {new Date().getFullYear()} FaceAttend EDU.{" "}
                        {t("Todos los derechos reservados.")}
                    </Text>

                    {/* Social Links */}
                    <View style={{ flexDirection: "row", gap: sp(12) }}>
                        {["github", "twitter", "linkedin"].map((social) => (
                            <View
                                key={social}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: c.background.elevated,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Feather
                                    name={social}
                                    size={14}
                                    color={c.text.secondary}
                                />
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

// ── Landing View (Main) ──────────────────────────────────────

export default function LandingView({ onNavigate }) {
    const entrance = useHeroEntrance();
    const { sp, isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;

    // Altura estandarizada para todas las secciones
    const SECTION_HEIGHT = "95vh";

    // Obtener configuraciones de fondo personalizadas
    const heroBg = getSectionBackground("hero");
    const testimonialsBg = getSectionBackground("testimonials");

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: c.background.app }}
            edges={["top", "bottom"]}
        >
            <CustomScrollBar
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={true}
                scrollbarStyle={{
                    variant: 'minimal',
                }}
            >
                {/* Sección 1: Hero */}
                <View
                    style={{
                        minHeight: SECTION_HEIGHT,
                        overflow: "hidden",
                    }}
                >
                    {heroBg ? (
                        <BackgroundImage
                            source={heroBg.source}
                            blur={heroBg.blur}
                            opacity={heroBg.opacity}
                            pattern={heroBg.pattern}
                            flipHorizontal={heroBg.flipHorizontal}
                            flipVertical={heroBg.flipVertical}
                            position={heroBg.position}
                            overlayColor={c.background.app}
                            overlayOpacity={heroBg.overlayOpacity}
                            style={{
                                minHeight: SECTION_HEIGHT,
                            }}
                        >
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: sp(isSmall ? 40 : 60),
                                }}
                            >
                                <HeroContent {...entrance} onNavigate={onNavigate} />
                            </View>
                        </BackgroundImage>
                    ) : (
                        <View
                            style={{
                                flex: 1,
                                alignItems: "center",
                                justifyContent: "center",
                                paddingVertical: sp(isSmall ? 40 : 60),
                                backgroundColor: c.background.app,
                            }}
                        >
                            <HeroContent {...entrance} onNavigate={onNavigate} />
                        </View>
                    )}
                </View>

                {/* Sección 2: Features */}
                <View
                    style={{
                        minHeight: SECTION_HEIGHT,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: sp(isSmall ? 40 : 60),
                        backgroundColor: c.brand.primary,
                    }}
                >
                    <FeaturesContent />
                </View>

                {/* Sección 3: Testimonials */}
                <View
                    style={{
                        minHeight: SECTION_HEIGHT,
                        overflow: "hidden",
                    }}
                >
                    {testimonialsBg ? (
                        <BackgroundImage
                            source={testimonialsBg.source}
                            blur={testimonialsBg.blur}
                            opacity={testimonialsBg.opacity}
                            pattern={testimonialsBg.pattern}
                            flipHorizontal={testimonialsBg.flipHorizontal}
                            flipVertical={testimonialsBg.flipVertical}
                            position={testimonialsBg.position}
                            overlayColor={c.background.app}
                            overlayOpacity={testimonialsBg.overlayOpacity}
                            style={{
                                minHeight: SECTION_HEIGHT,
                            }}
                        >
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: sp(isSmall ? 40 : 60),
                                }}
                            >
                                <TestimonialsContent />
                            </View>
                        </BackgroundImage>
                    ) : (
                        <View
                            style={{
                                flex: 1,
                                alignItems: "center",
                                justifyContent: "center",
                                paddingVertical: sp(isSmall ? 40 : 60),
                                backgroundColor: c.background.app,
                            }}
                        >
                            <TestimonialsContent />
                        </View>
                    )}
                </View>

                {/* Sección 4: CTA + Footer */}
                <View
                    style={{
                        minHeight: SECTION_HEIGHT,
                        justifyContent: "space-between",
                    }}
                >
                    {/* CTA con fondo azul */}
                    <View
                        style={{
                            backgroundColor: c.brand.primary,
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingVertical: sp(isSmall ? 40 : 60),
                        }}
                    >
                        <CTAContent onNavigate={onNavigate} />
                    </View>
                    
                    {/* Footer con fondo blanco */}
                    <Footer />
                </View>
            </CustomScrollBar>
        </SafeAreaView>
    );
}