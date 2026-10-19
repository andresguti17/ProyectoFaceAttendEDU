// ============================================================
//  FaceAttend EDU — Roles VIEW (Presentation Layer)
//
//  Matriz rol x permiso (HU-IAM-003, FR 1.1.2). Solo Super Admin.
// ============================================================

import React from "react";
import { View, ScrollView } from "react-native";
import { PageHeader } from "./components/common";
import { useTheme } from "./components/hooks/useTheme";
import { useResponsive } from "./components/hooks/useResponsive";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { RolesManager } from "./authorized/roles/RolesManager";

export default function RolesView() {
    const { isSmall } = useResponsive();
    const { theme } = useTheme();
    const c = theme.colors;
    const { t } = useTranslation();

    return (
        <View style={{ flex: 1, backgroundColor: c.background.app }}>
            <PageHeader
                title={t("Roles y permisos")}
                subtitle={t("Asigna permisos a cada rol (solo Super Admin)")}
            />
            <ScrollView
                contentContainerStyle={{ padding: isSmall ? 16 : 24, gap: 16 }}
                showsVerticalScrollIndicator={false}
            >
                <RolesManager />
            </ScrollView>
        </View>
    );
}
