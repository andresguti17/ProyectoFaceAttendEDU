// ============================================================
//  InstitutionInfo — Nombre, slug y tipo de período académico
//  UI pura. Sin estado propio.
//
//  Props:
//   - institutionName / onNameChange  : string + setter
//   - institutionSlug / onSlugChange  : string + setter
//   - academicPeriodType / onPeriodTypeChange : string + setter
//   - isSmall : boolean (responsive)
// ============================================================
import React from "react";
import { View, Text, TextInput } from "react-native";
import { useTranslation } from "../../../../../core/utils/i18n/hooks/useTranslation";
import { AcademicPeriodSelector } from "../../../../components/settings/tabs";
import { useSettingsSectionStyles } from "../../modals/useSettingsSectionStyles";

export function InstitutionInfo({
    institutionName, onNameChange,
    institutionSlug, onSlugChange,
    academicPeriodType, onPeriodTypeChange,
    isSmall,
}) {
    const { t } = useTranslation();
    const { c, labelStyle, descStyle, inputStyle } = useSettingsSectionStyles();

    return (
        <View style={{ gap: 12 }}>
            <View style={{ flexDirection: isSmall ? "column" : "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>{t("Nombre de la institución")}</Text>
                    <TextInput
                        value={institutionName}
                        onChangeText={onNameChange}
                        style={inputStyle}
                        placeholder={t("Ej: Universidad Nacional")}
                        placeholderTextColor={c.text.disabled}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>{t("Identificador único (slug)")}</Text>
                    <TextInput
                        value={institutionSlug}
                        onChangeText={(text) =>
                            onSlugChange(text.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                        }
                        style={inputStyle}
                        placeholder={t("Ej: universidad-nacional")}
                        placeholderTextColor={c.text.disabled}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>{t("Tipo de período académico")}</Text>
                    <AcademicPeriodSelector
                        value={academicPeriodType}
                        onChange={onPeriodTypeChange}
                    />
                </View>
            </View>
            <Text style={descStyle}>
                {t("El nombre aparece en reportes y correos. El identificador se usa en la URL. El tipo de período define cómo se divide el año lectivo.")}
            </Text>
        </View>
    );
}
