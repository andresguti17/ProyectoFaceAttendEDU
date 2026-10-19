import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

export function StatsRow({ label, value, icon, color }) {
    const { theme } = useTheme();
    const c = theme.colors;

    return (
        <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 12,
        }}>
            <View style={{
                width: 32,
                height: 32,
                borderRadius: 14,
                backgroundColor: color + "20",
                alignItems: "center",
                justifyContent: "center",
            }}>
                <Feather name={icon} size={15} color={color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: c.text.secondary }}>
                    {label}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.primary }}>
                    {value}
                </Text>
            </View>
        </View>
    );
}
