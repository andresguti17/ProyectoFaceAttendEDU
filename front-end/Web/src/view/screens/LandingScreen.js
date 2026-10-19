// ============================================================
//  FaceAttend EDU — Landing Screen
//  Screen wrapper que maneja navegación y pasa props a LandingView
// ============================================================

import React from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Image, Text } from "react-native";
import { Navbar } from "../components/common/navigation/Navbar";
import { ThemeToggle } from "../components/common/navigation/ThemeToggle";
import { LanguageSelector } from "../components/common/navigation/LanguageSelector";
import LandingView from "../LandingView";
import { useResponsive } from "../components/hooks/useResponsive";
import { useTheme } from "../components/hooks/useTheme";
import { getTypography } from "../../core/constants/typography";

/**
 * AppNavbar - Barra de navegación superior para landing
 */
function AppNavbar() {
    const { sp, fs } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const T = getTypography(fs);

    return (
        <Navbar
            left={
                <View style={{ flexDirection: "row", alignItems: "center", gap: sp(12) }}>
                    <Image
                        source={require("../../assets/images/logoFaceAttend.svg")}
                        style={{ width: sp(45), height: sp(45) }}
                    />
                    <Text style={[T.brandName, { color: c.text.primary }]}>
                        FaceAttend{" "}
                        <Text style={{ color: c.brand.primary }}>EDU</Text>
                    </Text>
                </View>
            }
            right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: sp(12) }}>
                    <ThemeToggle />
                    <LanguageSelector />
                </View>
            }
        />
    );
}

/**
 * LandingScreen - Screen principal que maneja navegación
 */
export default function LandingScreen() {
    const navigation = useNavigation();

    const handleNavigate = (routeName) => {
        navigation.navigate(routeName);
    };

    return (
        <>
            <AppNavbar />
            <LandingView onNavigate={handleNavigate} />
        </>
    );
}
