import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { HexInput } from "./HexInput";

export function HexInputSection({ currentHex, onHexChange }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    
    const [showHexInput, setShowHexInput] = useState(false);

    return (
        <>
            <TouchableOpacity
                onPress={() => setShowHexInput(v => !v)}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6
                }}
            >
                <Feather
                    name={showHexInput ? "chevron-up" : "chevron-down"}
                    size={13}
                    color={c.text.secondary}
                />
                <Text style={{ fontSize: 11, color: c.text.secondary }}>
                    {showHexInput ? t("Ocultar entrada HEX") : t("Ingresar código HEX manualmente")}
                </Text>
            </TouchableOpacity>
            {showHexInput && (
                <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 11, color: c.text.secondary }}>
                        {t("Pega directamente un color de tu paleta de marca, Figma, o cualquier herramienta.")}
                    </Text>
                    <HexInput value={currentHex} onChange={onHexChange} />
                </View>
            )}
        </>
    );
}
