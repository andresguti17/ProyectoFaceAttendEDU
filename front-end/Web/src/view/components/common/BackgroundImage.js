import React from "react";
import { View, ImageBackground, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Componente de fondo personalizable con imagen y efectos
 * Preparado para recibir imágenes en runtime desde el usuario
 * 
 * @param {string|object} source - URI de la imagen { uri: "https://..." } o null
 * @param {object} children - Contenido sobre el fondo
 * @param {number} blur - Nivel de desenfoque (0-10)
 * @param {number} opacity - Opacidad de la imagen (0-1)
 * @param {string} pattern - Patrón de división: 'none', 'grid', 'circle'
 * @param {boolean} flipHorizontal - Voltear horizontalmente
 * @param {boolean} flipVertical - Voltear verticalmente
 * @param {string} position - Posición: 'center', 'top', 'bottom', 'left', 'right'
 * @param {string} overlayColor - Color del overlay (gradiente)
 * @param {number} overlayOpacity - Opacidad del overlay (0-1)
 * @param {object} style - Estilos adicionales
 */
export function BackgroundImage({
    source,
    children,
    blur = 0,
    opacity = 0.15,
    pattern = "none",
    flipHorizontal = false,
    flipVertical = false,
    position = "center",
    overlayColor = "transparent",
    overlayOpacity = 0.6,
    style,
    ...props
}) {
    // Si no hay source, solo renderizar children
    if (!source) {
        return <View style={[{ flex: 1 }, style]} {...props}>{children}</View>;
    }

    // Transformaciones de la imagen
    const imageTransform = [];
    if (flipHorizontal) imageTransform.push({ scaleX: -1 });
    if (flipVertical) imageTransform.push({ scaleY: -1 });

    // Posicionamiento de la imagen
    const imagePosition = {
        center: "center",
        top: "flex-start",
        bottom: "flex-end",
        left: "flex-start",
        right: "flex-end",
    };

    // Patrón SVG simulado con Views (simplificado para React Native)
    const renderPattern = () => {
        if (pattern === "none") return null;

        const patternStyle = {
            ...StyleSheet.absoluteFillObject,
            opacity: 0.1,
        };

        switch (pattern) {
            case "grid":
                return (
                    <View style={patternStyle} pointerEvents="none">
                        {/* Grid pattern con líneas */}
                        <View
                            style={{
                                flex: 1,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.1)",
                            }}
                        >
                            {[...Array(10)].map((_, i) => (
                                <View
                                    key={`h-${i}`}
                                    style={{
                                        position: "absolute",
                                        left: 0,
                                        right: 0,
                                        top: `${i * 10}%`,
                                        height: 1,
                                        backgroundColor: "rgba(255,255,255,0.1)",
                                    }}
                                />
                            ))}
                            {[...Array(10)].map((_, i) => (
                                <View
                                    key={`v-${i}`}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        bottom: 0,
                                        left: `${i * 10}%`,
                                        width: 1,
                                        backgroundColor: "rgba(255,255,255,0.1)",
                                    }}
                                />
                            ))}
                        </View>
                    </View>
                );

            case "circle":
                return (
                    <View style={patternStyle} pointerEvents="none">
                        {[...Array(5)].map((_, i) => (
                            <View
                                key={i}
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    width: (i + 1) * 200,
                                    height: (i + 1) * 200,
                                    marginLeft: -(i + 1) * 100,
                                    marginTop: -(i + 1) * 100,
                                    borderRadius: (i + 1) * 100,
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.1)",
                                }}
                            />
                        ))}
                    </View>
                );

            default:
                return null;
        }
    };

    // Convertir overlayOpacity a hex para colores
    const overlayHex = Math.round(overlayOpacity * 255)
        .toString(16)
        .padStart(2, "0");

    return (
        <View style={[{ flex: 1 }, style]} {...props}>
            {/* Imagen de fondo */}
            <ImageBackground
                source={source}
                style={[
                    StyleSheet.absoluteFillObject,
                    {
                        opacity,
                        transform: imageTransform,
                        justifyContent: imagePosition[position] || "center",
                    },
                ]}
                resizeMode="cover"
                blurRadius={blur}
            />

            {/* Patrón overlay */}
            {renderPattern()}

            {/* Gradiente overlay para mezclar con el fondo usando LinearGradient */}
            {overlayColor !== "transparent" && (
                <LinearGradient
                    colors={[
                        `${overlayColor}${overlayHex}`,
                        overlayColor,
                    ]}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                />
            )}

            {/* Contenido sobre el fondo */}
            <View style={{ flex: 1, zIndex: 1 }}>{children}</View>
        </View>
    );
}

export default BackgroundImage;
