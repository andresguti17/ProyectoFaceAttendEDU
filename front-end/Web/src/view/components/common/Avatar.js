import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";

/**
 * Avatar component - muestra iniciales del nombre
 */
export function Avatar({ name = "", size = 40, color }) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    // Obtener iniciales
    const initials = name
        .split(" ")
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join("");
    
    const backgroundColor = color || c.brand.primary;
    
    return (
        <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor,
            alignItems: "center",
            justifyContent: "center",
        }}>
            <Text style={{
                color: "#FFFFFF",
                fontSize: size / 2.5,
                fontWeight: "600",
            }}>
                {initials || "?"}
            </Text>
        </View>
    );
}

export default Avatar;
