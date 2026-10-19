import React from "react";
import { View } from "react-native";
import { useTheme } from "../hooks/useTheme";

/**
 * Divider component - línea separadora horizontal
 */
export function Divider({ style }) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    return (
        <View style={[{
            height: 1,
            backgroundColor: c.border.primary,
            marginVertical: 0,
        }, style]} />
    );
}

export default Divider;
