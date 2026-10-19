// ============================================================
//  LanguageSelector - Selector de idioma con dropdown
// ============================================================

import React, { useState } from "react";
import { TouchableOpacity, View, Text, Modal, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useResponsive } from "../../hooks/useResponsive";
import { useLanguage } from "../../../../core/utils/i18n/hooks/useLanguage";
import { SUPPORTED_LANGUAGES } from "../../../../core/utils/i18n/constants/SupportedLanguages";
import { getTypography } from "../../../../core/constants/typography";

export function LanguageSelector() {
    const [showDropdown, setShowDropdown] = useState(false);
    const { theme } = useTheme();
    const { sp, fs } = useResponsive();
    const { currentLanguage, setLanguage } = useLanguage();
    const c = theme.colors;
    const T = getTypography(fs);

    const handleLanguageSelect = (langCode) => {
        setLanguage(langCode);
        setShowDropdown(false);
    };

    // Obtener la bandera actual
    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage);
    const currentFlag = currentLang?.flag || "🌐";

    return (
        <>
            <TouchableOpacity
                onPress={() => setShowDropdown(true)}
                style={{
                    width: sp(40),
                    height: sp(40),
                    borderRadius: sp(100),
                    backgroundColor: c.background.elevated,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: c.border.primary,
                    
                }}
                activeOpacity={0.7}
            >
                <Text style={{ fontSize: sp(20), transform: [{ translateY: -sp(2) }] }}>{currentFlag}</Text>
            </TouchableOpacity>

            {/* Dropdown Modal */}
            <Modal
                visible={showDropdown}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDropdown(false)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                    activeOpacity={1}
                    onPress={() => setShowDropdown(false)}
                >
                    <View
                        style={{
                            backgroundColor: c.background.surface,
                            borderRadius: sp(16),
                            padding: sp(8),
                            minWidth: 280,
                            maxHeight: 400,
                            borderWidth: 1,
                            borderColor: c.border.primary,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 12,
                            elevation: 15,
                        }}
                        onStartShouldSetResponder={() => true}
                    >
                        {/* Header */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: sp(12),
                                paddingVertical: sp(12),
                                borderBottomWidth: 1,
                                borderBottomColor: c.border.primary,
                            }}
                        >
                            <Text
                                style={[
                                    T.bodyMD,
                                    {
                                        fontWeight: "600",
                                        color: c.text.primary,
                                    },
                                ]}
                            >
                                Seleccionar idioma
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowDropdown(false)}
                                style={{
                                    padding: sp(4),
                                }}
                            >
                                <Feather
                                    name="x"
                                    size={sp(20)}
                                    color={c.text.secondary}
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Language List */}
                        <FlatList
                            data={SUPPORTED_LANGUAGES}
                            keyExtractor={(item) => item.code}
                            renderItem={({ item }) => {
                                const isSelected = item.code === currentLanguage;
                                return (
                                    <TouchableOpacity
                                        onPress={() => handleLanguageSelect(item.code)}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            paddingHorizontal: sp(16),
                                            paddingVertical: sp(12),
                                            backgroundColor: isSelected
                                                ? c.brand.primaryLight
                                                : "transparent",
                                            borderRadius: sp(8),
                                            marginHorizontal: sp(4),
                                            marginVertical: sp(2),
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: sp(12),
                                            }}
                                        >
                                            <Text style={{ fontSize: sp(24) }}>
                                                {item.flag}
                                            </Text>
                                            <View>
                                                <Text
                                                    style={[
                                                        T.bodyMD,
                                                        {
                                                            color: isSelected
                                                                ? c.brand.primary
                                                                : c.text.primary,
                                                            fontWeight: isSelected
                                                                ? "600"
                                                                : "400",
                                                        },
                                                    ]}
                                                >
                                                    {item.label}
                                                </Text>
                                                <Text
                                                    style={[
                                                        T.caption,
                                                        {
                                                            color: isSelected
                                                                ? c.brand.primary
                                                                : c.text.tertiary,
                                                        },
                                                    ]}
                                                >
                                                    {item.labelES}
                                                </Text>
                                            </View>
                                        </View>
                                        {isSelected && (
                                            <Feather
                                                name="check"
                                                size={sp(20)}
                                                color={c.brand.primary}
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}
