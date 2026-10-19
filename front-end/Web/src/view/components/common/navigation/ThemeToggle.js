// ============================================================
//  ThemeToggle - Control de alternancia de tema
// ============================================================

import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";

export function ThemeToggle() {
    const { theme, toggleMode } = useTheme();
    const { sp } = useResponsive();
    const c = theme.colors;
    const isDark = theme.mode === "dark";

    return (
        <TouchableOpacity
            onPress={toggleMode}
            style={{
                width: sp(40),
                height: sp(40),
                borderRadius: sp(20),
                backgroundColor: c.background.elevated,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: c.border.primary,
            }}
            activeOpacity={0.7}
        >
            <Feather
                name={isDark ? "sun" : "moon"}
                size={sp(20)}
                color={c.text.primary}
            />
        </TouchableOpacity>
    );
}
