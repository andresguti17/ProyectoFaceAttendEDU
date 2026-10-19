import React from "react";
import { View, Text, Switch } from "react-native";
import { useTheme } from "../hooks/useTheme";

/**
 * ToggleRow component - fila con switch
 */
export function ToggleRow({ label, description, value, onToggle, disabled = false }) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    return (
        <View style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: 8,
        }}>
            <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: c.text.primary,
                    marginBottom: description ? 4 : 0,
                }}>
                    {label}
                </Text>
                {description && (
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                        lineHeight: 18,
                    }}>
                        {description}
                    </Text>
                )}
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                disabled={disabled}
                trackColor={{
                    false: c.interactive.disabled,
                    true: c.brand.primary,
                }}
                thumbColor={c.text.onBrand}
            />
        </View>
    );
}

export default ToggleRow;
