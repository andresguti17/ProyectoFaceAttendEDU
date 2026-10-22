// ============================================================
//  FutureNotice — Aviso de ajuste guardado pero aún sin efecto
//  UI pura. Sin estado propio.
//
//  Props:
//   - message : string — qué todavía no hace el sistema
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSettingsSectionStyles } from "../modals/useSettingsSectionStyles";

export function FutureNotice({ message }) {
    const { c } = useSettingsSectionStyles();
    return (
        <View style={{ backgroundColor: c.brand.primaryLight, borderRadius: 14, padding: 12, flexDirection: "row", gap: 8 }}>
            <Feather name="info" size={13} color={c.brand.primary} style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 12, color: c.brand.primary, flex: 1, lineHeight: 18 }}>{message}</Text>
        </View>
    );
}
