import React, {useMemo} from "react";
import {Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View} from "react-native";
import {useTranslation} from "react-i18next";
import {useTheme} from '../components/common/ThemeContext';
import BackButton from '../components/common/BackButton';
import CustomAlert from '../components/common/CustomAlert';
import PrimaryButton from '../components/auth/PrimaryButton';
import {createValidAllJustificationsStyles} from "./Styles/ValidAllJustifications/Style";
import {useJustificationsViewModel} from '../../viewmodels/useValidAllJustificationsViewModel';

const CATEGORY_LABEL_KEYS = {
    health: 'admin.categoryHealth',
    family: 'admin.categoryFamily',
    academic: 'admin.categoryAcademic',
    general: 'admin.categoryGeneral',
};

export default function JustificationsScreen() {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createValidAllJustificationsStyles(colors), [colors]);

    const {
        justifications,
        updateKey,
        categories,
        getJustificationsByCategory,
        handleBack,
        editType,
        deleteType,
        createType,
        alertConfig,
        hideAlert,
    } = useJustificationsViewModel();

    const actionButton = (color) => ({paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: color});

    const renderJustificationItem = (item, index) => (
        <View
            key={item.id}
            style={[
                styles.validAllJustificationsItemCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder }
            ]}
        >
            <View style={styles.validAllJustificationsItemHeader}>
                <View style={[styles.validAllJustificationsItemNumber, { backgroundColor: colors.primary }]}>
                    <Text style={styles.validAllJustificationsItemNumberText}>{index + 1}</Text>
                </View>
                <Text style={[styles.validAllJustificationsItemType, { color: colors.text }]}>
                    {item.type}
                </Text>
            </View>

            <View style={[styles.validAllJustificationsItemSeparator, { backgroundColor: colors.separator }]} />

            <View style={styles.validAllJustificationsItemFooter}>
                <View style={[styles.validAllJustificationsItemBadge, { backgroundColor: colors.badgeBackground }]}>
                    <Text style={[styles.validAllJustificationsItemBadgeText, { color: colors.badgeText }]}>
                        {t(CATEGORY_LABEL_KEYS[item.category])}
                    </Text>
                </View>
                <Text style={[styles.validAllJustificationsItemDocText, { color: colors.textMuted }]}>
                    {item.requiresDocument ? t('admin.requiresDocument') : t('admin.noDocumentRequired')}
                </Text>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10}}>
                <TouchableOpacity style={actionButton(colors.primary)} onPress={() => editType(item)} accessibilityRole="button">
                    <Text style={{color: colors.primary}}>{t('common.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={actionButton(colors.danger)} onPress={() => deleteType(item)} accessibilityRole="button">
                    <Text style={{color: colors.danger}}>{t('common.delete')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView
            style={[styles.validAllJustificationsSafeArea, { backgroundColor: colors.background }]}
            key={`${updateKey}`}
        >
            <View style={[styles.validAllJustificationsContainer, { backgroundColor: colors.background,  marginTop: Platform.OS === "ios" ? 0 : 50, marginHorizontal: 10 } ]}>
                <View style={[styles.validAllJustificationsHeader, { backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <BackButton onPress={handleBack} />
                    <Text style={[styles.validAllJustificationsTitle, { color: colors.text, flex: 1 }]}>
                        {t("justifications.validList")}
                    </Text>
                    <View style={[styles.validAllJustificationsBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.validAllJustificationsBadgeText}>{justifications.length}</Text>
                    </View>
                </View>

                <View style={[styles.validAllJustificationsSeparator, { backgroundColor: colors.separator }]} />

                <PrimaryButton title={t('admin.addNewJustification')} onPress={createType} />

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.validAllJustificationsScrollContent}>
                    {justifications.length > 0 ? (
                        categories.map((category) => {
                            const categoryItems = getJustificationsByCategory(category);
                            return (
                                <View key={category} style={styles.validAllJustificationsCategorySection}>
                                    <View style={[styles.validAllJustificationsCategoryHeader, { backgroundColor: colors.categoryBackground }]}>
                                        <Text style={[styles.validAllJustificationsCategoryTitle, { color: colors.categoryText }]}>
                                            {t(CATEGORY_LABEL_KEYS[category])}
                                        </Text>
                                        <Text style={[styles.validAllJustificationsCategoryCount, { color: colors.textMuted }]}>
                                            {categoryItems.length} {t('justifications.items')}
                                        </Text>
                                    </View>
                                    {categoryItems.map((item, index) => renderJustificationItem(item, index))}
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.validAllJustificationsEmptyState}>
                            <Text style={styles.validAllJustificationsEmptyIcon}>📋</Text>
                            <Text style={[styles.validAllJustificationsEmptyTitle, { color: colors.text }]}>
                                {t('justifications.noJustifications')}
                            </Text>
                            <Text style={[styles.validAllJustificationsEmptyDescription, { color: colors.textMuted }]}>
                                {t('justifications.noJustificationsDesc')}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                onClose={hideAlert}
                type={alertConfig.type}
            />
        </SafeAreaView>
    );
}