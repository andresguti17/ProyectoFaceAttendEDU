import React, { useState, useEffect } from "react";
import { View, Text, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

export function HexInput({ value, onChange }) {
    const { theme } = useTheme();
    const c = theme.colors;
    const [raw, setRaw] = useState(value.replace("#", ""));
    const [valid, setValid] = useState(true);

    useEffect(() => {
        setRaw(value.replace("#", ""));
    }, [value]);

    function handleChange(text) {
        const cleaned = text.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
        setRaw(cleaned);
        if (cleaned.length === 6) {
            setValid(true);
            onChange("#" + cleaned);
        } else {
            setValid(false);
        }
    }

    return (
        <View style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1.5,
            borderColor: valid ? c.border.primary : "#EF4444",
            borderRadius: 14,
            overflow: "hidden",
            height: 40,
        }}>
            <View style={{
                width: 40,
                height: "100%",
                backgroundColor: valid ? value : c.interactive.disabled,
                borderRightWidth: 1.5,
                borderRightColor: c.border.primary,
                alignItems: "center",
                justifyContent: "center",
            }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                    #
                </Text>
            </View>
            <TextInput
                value={raw.toUpperCase()}
                onChangeText={handleChange}
                autoCapitalize="characters"
                placeholder="HEX"
                placeholderTextColor={c.text.disabled}
                style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    fontSize: 11,
                    fontWeight: "600",
                    color: c.text.primary,
                    fontFamily: "monospace",
                }}
                maxLength={6}
            />
            {!valid && raw.length > 0 && (
                <Feather
                    name="alert-circle"
                    size={14}
                    color="#EF4444"
                    style={{ marginRight: 10 }}
                />
            )}
        </View>
    );
}
