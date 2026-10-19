// ============================================================
//  FaceAttend EDU — CustomScrollBar Component
// ============================================================
//  Componente genérico de ScrollBar con estilos personalizados
//  y efectos de UX configurables para web y móvil
// ============================================================

import React, { useRef, useEffect, useState, useCallback } from "react";
import { ScrollView, View, Animated, Platform, StyleSheet } from "react-native";
import { useTheme } from "../hooks/useTheme";

// Para Web, necesitamos acceso directo al DOM
const isWeb = Platform.OS === 'web';

/**
 * CustomScrollBar - Componente de scroll personalizado con efectos avanzados
 * 
 * @param {Object} props - Propiedades del componente
 * @param {React.ReactNode} props.children - Contenido a renderizar dentro del scroll
 * @param {Object} props.style - Estilos adicionales para el contenedor del scroll
 * @param {Object} props.contentContainerStyle - Estilos para el contenedor del contenido
 * @param {boolean} props.showsVerticalScrollIndicator - Mostrar scrollbar vertical (default: true)
 * @param {boolean} props.showsHorizontalScrollIndicator - Mostrar scrollbar horizontal (default: false)
 * @param {boolean} props.bounces - Habilitar rebote en los bordes (default: false)
 * @param {boolean} props.horizontal - ScrollView horizontal (default: false)
 * 
 * @param {Object} props.effects - Configuración de efectos especiales
 * @param {Object} props.effects.autoSlide - Configuración del efecto de auto-desplazamiento
 * @param {boolean} props.effects.autoSlide.enabled - Activar auto-slide
 * @param {number} props.effects.autoSlide.interval - Intervalo en ms entre desplazamientos (default: 3000)
 * @param {number} props.effects.autoSlide.distance - Distancia de desplazamiento en px (default: 100)
 * @param {string} props.effects.autoSlide.direction - Dirección: 'vertical' | 'horizontal' (default: 'vertical')
 * @param {boolean} props.effects.autoSlide.pauseOnInteraction - Pausar al interactuar (default: true)
 * @param {string} props.effects.autoSlide.target - Target: 'loop' | 'end' | 'start' (default: 'loop')
 * @param {string} props.effects.autoSlide.trigger - Trigger externo: callback function
 * @param {number} props.effects.autoSlide.triggerDelay - Delay al disparar trigger en ms (default: 300)
 * 
 * @param {Object} props.effects.smoothElastic - Efecto de scroll elástico suave
 * @param {boolean} props.effects.smoothElastic.enabled - Activar smooth elastic
 * @param {number} props.effects.smoothElastic.tension - Tensión del rebote 0-100 (default: 40)
 * @param {number} props.effects.smoothElastic.friction - Fricción 0-100 (default: 7)
 * 
 * @param {Object} props.effects.progressIndicator - Indicador de progreso del scroll
 * @param {boolean} props.effects.progressIndicator.enabled - Activar indicador
 * @param {string} props.effects.progressIndicator.position - Posición: 'top' | 'bottom' | 'left' | 'right' (default: 'right')
 * @param {string} props.effects.progressIndicator.color - Color del indicador (default: theme primary)
 * @param {number} props.effects.progressIndicator.thickness - Grosor en px (default: 3)
 * 
 * @param {Object} props.effects.fadeEdges - Degradado en los bordes
 * @param {boolean} props.effects.fadeEdges.enabled - Activar fade edges
 * @param {number} props.effects.fadeEdges.size - Tamaño del degradado en px (default: 30)
 * @param {string} props.effects.fadeEdges.color - Color base del degradado (default: theme background)
 * @param {Array<string>} props.effects.fadeEdges.edges - Bordes a aplicar: ['top', 'bottom', 'left', 'right'] (default: ['top', 'bottom'])
 * 
 * @param {Object} props.effects.momentumBounce - Efecto de rebote con inercia
 * @param {boolean} props.effects.momentumBounce.enabled - Activar momentum bounce
 * @param {number} props.effects.momentumBounce.intensity - Intensidad del rebote 0-100 (default: 50)
 * @param {number} props.effects.momentumBounce.duration - Duración en ms (default: 400)
 * 
 * @param {Object} props.scrollbarStyle - Configuración de estilos del scrollbar
 * @param {string} props.scrollbarStyle.variant - Variante: 'default' | 'minimal' | 'modern' | 'rounded' (default: 'modern')
 * @param {number} props.scrollbarStyle.width - Ancho del scrollbar en px (default: según variant)
 * @param {string} props.scrollbarStyle.trackColor - Color de la pista (default: theme surface)
 * @param {string} props.scrollbarStyle.thumbColor - Color del thumb (default: theme primary)
 * @param {number} props.scrollbarStyle.thumbRadius - Radio de borde del thumb (default: según variant)
 * @param {number} props.scrollbarStyle.thumbOpacity - Opacidad del thumb 0-1 (default: 0.6)
 * @param {number} props.scrollbarStyle.thumbHoverOpacity - Opacidad al hover 0-1 (default: 0.8)
 * @param {boolean} props.scrollbarStyle.autoHide - Auto-ocultar scrollbar (default: false)
 * @param {number} props.scrollbarStyle.autoHideDelay - Delay de auto-ocultado en ms (default: 1000)
 * @param {string} props.scrollbarStyle.thumbHoverColor - Color al hover (default: thumbColor)
 * @param {boolean} props.scrollbarStyle.showTrack - Mostrar pista (default: true)
 * @param {number} props.scrollbarStyle.trackPadding - Padding de la pista (default: 0)
 */
const CustomScrollBar = ({
    children,
    style,
    contentContainerStyle,
    showsVerticalScrollIndicator = true,
    showsHorizontalScrollIndicator = false,
    bounces = false,
    horizontal = false,
    effects = {},
    scrollbarStyle = {},
    onScroll,
    ...restProps
}) => {
    const { theme } = useTheme();
    const scrollViewRef = useRef(null);
    const scrollProgress = useRef(new Animated.Value(0)).current;
    const [webScrollProgress, setWebScrollProgress] = useState(0);
    const [scrollMetrics, setScrollMetrics] = useState({
        contentHeight: 0,
        layoutHeight: 0,
        scrollY: 0,
    });
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const userScrollTimeout = useRef(null);

    // Configuración por defecto de efectos
    const defaultEffects = {
        autoSlide: {
            enabled: false,
            interval: 3000,
            distance: 100,
            direction: 'vertical',
            pauseOnInteraction: true,
            target: 'loop', // 'loop' | 'end' | 'start'
            trigger: null, // función callback externa
            triggerDelay: 300,
        },
        smoothElastic: {
            enabled: false,
            tension: 40,
            friction: 7,
        },
        progressIndicator: {
            enabled: false,
            position: 'right',
            color: theme.colors.brand.primary,
            thickness: 3,
        },
        fadeEdges: {
            enabled: false,
            size: 30,
            color: theme.colors.background.surface,
            edges: ['top', 'bottom'],
        },
        momentumBounce: {
            enabled: false,
            intensity: 50,
            duration: 400,
        },
    };

    // Variantes de scrollbar predefinidas
    const scrollbarVariants = {
        default: {
            width: 12,
            thumbRadius: 0,
            showTrack: true,
            trackColor: '#f0f0f0',
            thumbColor: '#c0c0c0',
            thumbOpacity: 1,
            thumbHoverOpacity: 1,
            thumbHoverColor: '#a0a0a0',
        },
        
        horizontal: {
            width: 6,
            thumbRadius: 3,
            showTrack: false,
            thumbColor: theme.colors.brand.primary,
            thumbOpacity: 0.4,
            thumbHoverOpacity: 0.7,
            thumbHoverColor: theme.colors.brand.primary,
        },
        
        pill: {
            width: 14,
            thumbWidth: 8,
            thumbRadius: 4,
            trackRadius: 7,
            showTrack: true,
            trackColor: 'rgba(0, 0, 0, 0.06)',
            thumbColor: theme.colors.brand.primary,
            thumbOpacity: 0.75,
            thumbHoverOpacity: 1,
            thumbHoverColor: theme.colors.brand.primaryDark || theme.colors.brand.primary,
            shadow: true,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            gradient: true,
            gradientColors: [theme.colors.brand.primary, theme.colors.brand.primaryDark || theme.colors.brand.primary],
        },
        
        minimal: {
            width: 12,
            thumbWidth: 6,
            thumbRadius: 3,
            showTrack: false,
            thumbColor: theme.colors.brand.primary,
            thumbOpacity: 0.6,
            thumbHoverOpacity: 0.9,
            thumbHoverColor: theme.colors.brand.primaryDark || theme.colors.brand.primary,
            shadow: true,
            shadowColor: 'rgba(0, 0, 0, 0.12)',
            gradient: true,
            gradientColors: [theme.colors.brand.primary, theme.colors.brand.primaryDark || theme.colors.brand.primary],
            autoHide: true,
        },
        
        glass: {
            width: 16,
            thumbWidth: 10,
            thumbRadius: 5,
            trackRadius: 8,
            showTrack: true,
            trackColor: 'rgba(255, 255, 255, 0.1)',
            thumbColor: 'rgba(255, 255, 255, 0.25)',
            thumbOpacity: 1,
            thumbHoverOpacity: 1,
            thumbHoverColor: 'rgba(255, 255, 255, 0.35)',
            shadow: true,
            shadowColor: 'rgba(0, 0, 0, 0.1)',
            border: true,
            borderColor: 'rgba(255, 255, 255, 0.3)',
            backdropBlur: true,
        },
        
        neon: {
            width: 14,
            thumbWidth: 9,
            thumbRadius: 4.5,
            trackRadius: 7,
            showTrack: true,
            trackColor: 'rgba(0, 0, 0, 0.3)',
            thumbColor: theme.colors.brand.primary,
            thumbOpacity: 0.9,
            thumbHoverOpacity: 1,
            thumbHoverColor: theme.colors.brand.primary,
            shadow: true,
            shadowColor: theme.colors.brand.primary,
            gradient: true,
            gradientColors: [theme.colors.brand.primary, theme.colors.brand.primaryDark || theme.colors.brand.primary],
            glow: true,
        },
        
        macos: {
            width: 12,
            thumbWidth: 8,
            thumbRadius: 4,
            trackRadius: 6,
            showTrack: true,
            trackColor: 'rgba(0, 0, 0, 0.05)',
            thumbColor: 'rgba(0, 0, 0, 0.3)',
            thumbOpacity: 1,
            thumbHoverOpacity: 1,
            thumbHoverColor: 'rgba(0, 0, 0, 0.5)',
            border: true,
            borderColor: 'rgba(0, 0, 0, 0.1)',
        },
    };

    const variant = scrollbarStyle.variant || 'pill';
    const variantConfig = scrollbarVariants[variant] || scrollbarVariants.pill;

    // Configuración por defecto de estilos del scrollbar
    const defaultScrollbarStyle = {
        width: variantConfig.width,
        thumbWidth: variantConfig.thumbWidth || variantConfig.width,
        trackColor: variantConfig.trackColor,
        trackRadius: variantConfig.trackRadius || variantConfig.thumbRadius,
        thumbColor: variantConfig.thumbColor,
        thumbRadius: variantConfig.thumbRadius,
        thumbOpacity: variantConfig.thumbOpacity,
        thumbHoverOpacity: variantConfig.thumbHoverOpacity,
        thumbHoverColor: variantConfig.thumbHoverColor,
        autoHide: variantConfig.autoHide || false,
        showTrack: variantConfig.showTrack,
        shadow: variantConfig.shadow,
        shadowColor: variantConfig.shadowColor,
        gradient: variantConfig.gradient,
        gradientColors: variantConfig.gradientColors,
        border: variantConfig.border,
        borderColor: variantConfig.borderColor,
        glow: variantConfig.glow,
        backdropBlur: variantConfig.backdropBlur,
    };

    // Merge configuraciones
    const effectsConfig = {
        autoSlide: { ...defaultEffects.autoSlide, ...effects.autoSlide },
        smoothElastic: { ...defaultEffects.smoothElastic, ...effects.smoothElastic },
        progressIndicator: { ...defaultEffects.progressIndicator, ...effects.progressIndicator },
        fadeEdges: { ...defaultEffects.fadeEdges, ...effects.fadeEdges },
        momentumBounce: { ...defaultEffects.momentumBounce, ...effects.momentumBounce },
    };

    const scrollbarConfig = { ...defaultScrollbarStyle, ...scrollbarStyle };

    // ── EFECTO 1: Auto Slide ──────────────────────────────────
    useEffect(() => {
        if (!effectsConfig.autoSlide.enabled) return;

        // Trigger externo (puede dispararse múltiples veces)
        if (effectsConfig.autoSlide.trigger) {
            const triggerAutoSlide = () => {
                // Ejecutar inmediatamente si el delay es 0
                if (effectsConfig.autoSlide.triggerDelay === 0) {
                    if (!scrollViewRef.current) return;
                    
                    let targetY = effectsConfig.autoSlide.target === 'end' ? 99999 
                        : effectsConfig.autoSlide.target === 'start' ? 0 
                        : effectsConfig.autoSlide.distance;
                    
                    if (isWeb) {
                        scrollViewRef.current.scrollTo({ top: targetY, behavior: 'smooth' });
                    } else {
                        scrollViewRef.current.scrollTo({ y: targetY, animated: true });
                    }
                } else {
                    // Con delay
                    setTimeout(() => {
                        if (!scrollViewRef.current) return;
                        
                        let targetY = effectsConfig.autoSlide.target === 'end' ? 99999 
                            : effectsConfig.autoSlide.target === 'start' ? 0 
                            : effectsConfig.autoSlide.distance;
                        
                        if (isWeb) {
                            scrollViewRef.current.scrollTo({ top: targetY, behavior: 'smooth' });
                        } else {
                            scrollViewRef.current.scrollTo({ y: targetY, animated: true });
                        }
                    }, effectsConfig.autoSlide.triggerDelay);
                }
            };
            
            // Registrar el callback (puede ser llamado múltiples veces)
            effectsConfig.autoSlide.trigger(triggerAutoSlide);
            return;
        }

        // Auto-slide continuo con intervalo
        const timer = setInterval(() => {
            if (effectsConfig.autoSlide.pauseOnInteraction && isUserScrolling) return;
            if (!scrollViewRef.current) return;

            const { scrollY, contentHeight, layoutHeight } = scrollMetrics;
            const maxScroll = contentHeight - layoutHeight;
            
            let targetY = scrollY;
            
            if (effectsConfig.autoSlide.target === 'end' && scrollY < maxScroll) {
                targetY = maxScroll;
            } else if (effectsConfig.autoSlide.target === 'start' && scrollY > 0) {
                targetY = 0;
            } else {
                // Loop
                targetY = scrollY + effectsConfig.autoSlide.distance;
                if (targetY >= maxScroll) targetY = 0;
            }
            
            if (isWeb) {
                const prop = effectsConfig.autoSlide.direction === 'horizontal' ? 'left' : 'top';
                scrollViewRef.current.scrollTo({ [prop]: targetY, behavior: 'smooth' });
            } else {
                const prop = effectsConfig.autoSlide.direction === 'horizontal' ? 'x' : 'y';
                scrollViewRef.current.scrollTo({ [prop]: targetY, animated: true });
            }
        }, effectsConfig.autoSlide.interval);

        return () => clearInterval(timer);
    }, [
        effectsConfig.autoSlide.enabled,
        effectsConfig.autoSlide.trigger,
        effectsConfig.autoSlide.interval,
        effectsConfig.autoSlide.distance,
        effectsConfig.autoSlide.direction,
        effectsConfig.autoSlide.target,
        effectsConfig.autoSlide.pauseOnInteraction,
        effectsConfig.autoSlide.triggerDelay,
        isUserScrolling,
        scrollMetrics,
        isWeb,
    ]);

    // ── Handler de Scroll y Progress Tracking ────────────────
    const handleScroll = useCallback((event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const scrollY = contentOffset.y;
        const contentHeight = contentSize.height;
        const layoutHeight = layoutMeasurement.height;

        setScrollMetrics({ contentHeight, layoutHeight, scrollY });

        const maxScroll = contentHeight - layoutHeight;
        const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
        
        if (isWeb) {
            setWebScrollProgress(progress);
        } else {
            Animated.timing(scrollProgress, {
                toValue: progress,
                duration: 100,
                useNativeDriver: false,
            }).start();
        }

        setIsUserScrolling(true);
        if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
        userScrollTimeout.current = setTimeout(() => setIsUserScrolling(false), 150);

        if (onScroll) onScroll(event);
    }, [onScroll, scrollProgress, isWeb]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (userScrollTimeout.current) {
                clearTimeout(userScrollTimeout.current);
            }
        };
    }, []);

    // ── Configuración de bounces según efectos ───────────────
    const shouldBounce = effectsConfig.momentumBounce.enabled || bounces;

    // ── Configuración de deceleración para smooth elastic ────
    const decelerationRate = effectsConfig.smoothElastic.enabled
        ? effectsConfig.smoothElastic.friction / 100
        : 'normal';

    // ── Estilos CSS para web (scrollbar personalizado) ───────
    const getThumbBackground = () => {
        if (scrollbarConfig.gradient && scrollbarConfig.gradientColors) {
            return `linear-gradient(180deg, ${scrollbarConfig.gradientColors[0]}, ${scrollbarConfig.gradientColors[1]})`;
        }
        return scrollbarConfig.thumbColor;
    };
    
    const getThumbHoverBackground = () => {
        if (scrollbarConfig.gradient && scrollbarConfig.gradientColors) {
            return `linear-gradient(180deg, ${scrollbarConfig.thumbHoverColor}, ${scrollbarConfig.gradientColors[1]})`;
        }
        return scrollbarConfig.thumbHoverColor;
    };
    
    const thumbWidth = scrollbarConfig.thumbWidth || scrollbarConfig.width;
    const borderOffset = thumbWidth < scrollbarConfig.width 
        ? (scrollbarConfig.width - thumbWidth) / 2 
        : 0;
    
    const webScrollbarStyles = isWeb ? `
        .custom-scrollbar-${variant}::-webkit-scrollbar {
            width: ${scrollbarConfig.width}px;
            height: ${scrollbarConfig.width}px;
        }
        
        .custom-scrollbar-${variant}::-webkit-scrollbar-track {
            background: ${scrollbarConfig.showTrack ? scrollbarConfig.trackColor : 'transparent'};
            border-radius: ${scrollbarConfig.trackRadius}px;
            ${scrollbarConfig.backdropBlur ? 'backdrop-filter: blur(10px);' : ''}
        }
        
        .custom-scrollbar-${variant}::-webkit-scrollbar-thumb {
            background: ${getThumbBackground()};
            border-radius: ${scrollbarConfig.thumbRadius}px;
            opacity: ${scrollbarConfig.thumbOpacity};
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            ${borderOffset > 0 ? `
                border-left: ${borderOffset}px solid transparent;
                border-right: ${borderOffset}px solid transparent;
                background-clip: padding-box;
            ` : ''}
            ${scrollbarConfig.shadow && !scrollbarConfig.glow ? `box-shadow: 0 2px 8px ${scrollbarConfig.shadowColor};` : ''}
            ${scrollbarConfig.border ? `border: 1px solid ${scrollbarConfig.borderColor};` : ''}
            ${scrollbarConfig.glow ? `box-shadow: 0 0 12px ${scrollbarConfig.shadowColor}, 0 0 24px ${scrollbarConfig.shadowColor}50;` : ''}
        }
        
        .custom-scrollbar-${variant}::-webkit-scrollbar-thumb:hover {
            opacity: ${scrollbarConfig.thumbHoverOpacity};
            background: ${getThumbHoverBackground()};
            transform: scale(1.1);
            ${scrollbarConfig.shadow && !scrollbarConfig.glow ? `box-shadow: 0 4px 16px ${scrollbarConfig.shadowColor};` : ''}
            ${scrollbarConfig.glow ? `box-shadow: 0 0 16px ${scrollbarConfig.shadowColor}, 0 0 32px ${scrollbarConfig.shadowColor}70, 0 0 48px ${scrollbarConfig.shadowColor}40;` : ''}
        }
        
        .custom-scrollbar-${variant}::-webkit-scrollbar-thumb:active {
            opacity: 1;
            background: ${getThumbHoverBackground()};
            transform: scale(1.05);
        }
        
        ${scrollbarConfig.autoHide ? `
            .custom-scrollbar-${variant}::-webkit-scrollbar-thumb {
                transition: opacity 0.4s ease 0.3s, background 0.25s ease, transform 0.25s ease;
            }
            .custom-scrollbar-${variant}:not(:hover)::-webkit-scrollbar-thumb {
                opacity: 0;
            }
            .custom-scrollbar-${variant}:hover::-webkit-scrollbar-thumb {
                transition-delay: 0s;
            }
        ` : ''}
        
        .custom-scrollbar-${variant}::-webkit-scrollbar-corner {
            background: transparent;
        }
    ` : null;

    // Inyectar estilos CSS en web
    useEffect(() => {
        if (!isWeb || !webScrollbarStyles) return;
        
        const styleId = `scrollbar-${variant}`;
        let styleElement = document.getElementById(styleId);
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }
        
        styleElement.innerHTML = webScrollbarStyles;
        
        return () => {
            const style = document.getElementById(styleId);
            if (style && !document.querySelector(`.custom-scrollbar-${variant}`)) {
                style.remove();
            }
        };
    }, [webScrollbarStyles, variant, isWeb]);

    // ── Renderizado del indicador de progreso ────────────────
    const renderProgressIndicator = () => {
        if (!effectsConfig.progressIndicator.enabled) return null;

        const { position, thickness, color } = effectsConfig.progressIndicator;
        const isVertical = position === 'right' || position === 'left';

        const progressStyle = {
            position: 'absolute',
            backgroundColor: color,
            zIndex: 1000,
            pointerEvents: 'none',
            ...(isVertical 
                ? { width: thickness, [position]: 0, top: 0, bottom: 0 }
                : { height: thickness, [position]: 0, left: 0, right: 0 }
            ),
        };

        if (isWeb) {
            return (
                <div style={{
                    ...progressStyle,
                    [isVertical ? 'height' : 'width']: `${webScrollProgress * 100}%`,
                    transition: 'height 0.1s ease-out, width 0.1s ease-out',
                }} />
            );
        }

        const animatedStyle = isVertical
            ? { height: scrollProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
            : { width: scrollProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) };

        return <Animated.View style={[progressStyle, animatedStyle]} pointerEvents="none" />;
    };

    // ── Renderizado de fade edges ─────────────────────────────
    const renderFadeEdges = () => {
        if (!effectsConfig.fadeEdges.enabled) return null;

        const { size, color, edges } = effectsConfig.fadeEdges;

        return edges.map(edge => {
            const isVertical = edge === 'top' || edge === 'bottom';
            const gradientMap = {
                top: { dir: '180deg', colors: 'rgba(0,0,0,0), ' + color },
                bottom: { dir: '0deg', colors: color + ', rgba(0,0,0,0)' },
                left: { dir: '90deg', colors: 'rgba(0,0,0,0), ' + color },
                right: { dir: '270deg', colors: color + ', rgba(0,0,0,0)' },
            };

            const fadeStyle = {
                position: 'absolute',
                [edge]: 0,
                ...(isVertical ? { left: 0, right: 0, height: size } : { top: 0, bottom: 0, width: size }),
                opacity: 0.9,
                pointerEvents: 'none',
                zIndex: 999,
            };

            if (isWeb) {
                const { dir, colors } = gradientMap[edge];
                return <div key={edge} style={{ ...fadeStyle, background: `linear-gradient(${dir}, ${colors})` }} />;
            }

            return <View key={edge} style={fadeStyle} />;
        });
    };

    // En Web, usamos div nativo para aplicar estilos CSS correctamente
    if (isWeb) {
        const containerStyles = StyleSheet.flatten([styles.container, style]);
        const contentStyles = StyleSheet.flatten(contentContainerStyle) || {};
        
        return (
            <div style={{ 
                ...containerStyles,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {renderProgressIndicator()}
                <div
                    className={`custom-scrollbar-${variant}`}
                    ref={scrollViewRef}
                    onScroll={(e) => {
                        const nativeEvent = {
                            contentOffset: { x: e.target.scrollLeft, y: e.target.scrollTop },
                            contentSize: { height: e.target.scrollHeight, width: e.target.scrollWidth },
                            layoutMeasurement: { height: e.target.clientHeight, width: e.target.clientWidth },
                        };
                        handleScroll({ nativeEvent });
                    }}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        height: '100%',
                        width: '100%',
                        overflowY: horizontal ? 'hidden' : 'auto',
                        overflowX: horizontal ? 'auto' : 'hidden',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <div style={{
                        ...contentStyles,
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: contentStyles.flexGrow !== undefined ? contentStyles.flexGrow : 0,
                        minHeight: contentStyles.flexGrow ? '100%' : 'min-content',
                    }}>
                        {children}
                    </div>
                </div>
                {renderFadeEdges()}
            </div>
        );
    }

    // En móvil, usar ScrollView nativo
    return (
        <View style={[styles.container, style]}>
            {renderProgressIndicator()}
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={contentContainerStyle}
                showsVerticalScrollIndicator={showsVerticalScrollIndicator}
                showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
                horizontal={horizontal}
                bounces={shouldBounce}
                decelerationRate={decelerationRate}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                {...restProps}
            >
                {children}
            </ScrollView>
            {renderFadeEdges()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    scrollView: {
        flex: 1,
    },
});

export default CustomScrollBar;
