import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos del reporte de asistencia. Los estados (ausencia = danger, atraso = warning)
// y los neutros salen de los tokens del tema; usar con createAttendanceReportStyles(colors).
export const createAttendanceReportStyles = (colors) => {
const dangerTint = colors.danger + '1A';
const warningTint = colors.warning + '1A';
return StyleSheet.create(normalizeTypography({
alertBadgeCriticalReport: {
        backgroundColor: dangerTint,
    },

alertBadgeReport: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },

alertBadgeTextCriticalReport: {
        color: colors.danger,
    },

alertBadgeTextReport: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

alertBadgeTextWarningReport: {
        color: colors.warning,
    },

alertBadgeWarningReport: {
        backgroundColor: warningTint,
    },

containerReport: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 16 : 10,
    },

counterDividerReport: {
        width: 1,
        backgroundColor: colors.border,
        marginVertical: 4,
    },

counterItemReport: {
        alignItems: 'center',
        flex: 1,
    },

counterLabelReport: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '500',
    },

counterValueOverLimitReport: {
        color: colors.danger,
    },

counterValueReport: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 2,
    },

countersRowReport: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 14,
        backgroundColor: colors.background,
        borderRadius: 10,
        paddingVertical: 10,
    },

emptyStateDescriptionReport: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
    },

emptyStateReport: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 30,
    },

emptyStateTitleReport: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },

filterChipAllActiveReport: {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primary,
    },

filterChipCriticalActiveReport: {
        backgroundColor: dangerTint,
        borderColor: colors.danger,
    },

filterChipReport: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: colors.categoryBackground,
        borderWidth: 1,
        borderColor: 'transparent',
    },

filterChipTextAllActiveReport: {
        color: colors.primary,
    },

filterChipTextCriticalActiveReport: {
        color: colors.danger,
    },

filterChipTextReport: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
    },

filterChipTextWarningActiveReport: {
        color: colors.warning,
    },

filterChipWarningActiveReport: {
        backgroundColor: warningTint,
        borderColor: colors.warning,
    },

filterChipsRowReport: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },

generateButtonAbsenceReport: {
        borderColor: colors.danger + '4D',
        backgroundColor: dangerTint,
    },

generateButtonLatenessReport: {
        borderColor: colors.warning + '4D',
        backgroundColor: warningTint,
    },

generateButtonReport: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
    },

generateButtonTextAbsenceReport: {
        color: colors.danger,
    },

generateButtonTextLatenessReport: {
        color: colors.warning,
    },

generateButtonTextReport: {
        fontSize: 13,
        fontWeight: '600',
    },

headerBackButtonReport: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.backButtonBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },

headerBackTextReport: {
        fontSize: 20,
        color: colors.primary,
        fontWeight: '600',
    },

headerReport: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 45 : 15,
        paddingBottom: 16,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 3,
    },

headerTitleReport: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
        textAlign: 'center',
    },

loadingContainerReport: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },

loadingTextReport: {
        marginTop: 12,
        fontSize: 14,
        color: colors.textSecondary,
    },

mainGenerateButtonReport: {
        backgroundColor: colors.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 8,
        marginBottom: 24,
        gap: 8,
        shadowColor: colors.primary,
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },

mainGenerateButtonTextReport: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.onPrimary,
    },

modalActionsReport: {
        gap: 10,
    },

modalCancelButtonReport: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },

modalCancelButtonTextReport: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
    },

modalConfirmButtonReport: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },

modalConfirmButtonTextReport: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.onPrimary,
    },

modalHandleReport: {
        width: 40,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },

modalInfoDividerReport: {
        width: 1,
        backgroundColor: colors.border,
        marginVertical: 4,
    },

modalInfoItemReport: {
        alignItems: 'center',
        flex: 1,
    },

modalInfoLabelReport: {
        fontSize: 11,
        color: colors.textSecondary,
        textAlign: 'center',
    },

modalInfoRowReport: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
    },

modalInfoValueReport: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
    },

modalOverlayReport: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },

modalSheetReport: {
        backgroundColor: colors.modalBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    },

modalSubtitleReport: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },

modalTitleReport: {
        fontSize: 19,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 6,
        textAlign: 'center',
    },

progressBarContainerReport: {
        height: 7,
        backgroundColor: colors.progressBackground,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },

progressBarFillAbsenceReport: {
        height: '100%',
        backgroundColor: colors.danger,
        borderRadius: 4,
    },

progressBarFillLatenessReport: {
        height: '100%',
        backgroundColor: colors.warning,
        borderRadius: 4,
    },

progressBarFillSafeReport: {
        height: '100%',
        backgroundColor: colors.success,
        borderRadius: 4,
    },

progressLabelReport: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
    },

progressRowReport: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },

progressSectionReport: {
        marginBottom: 14,
    },

progressValueReport: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.danger,
    },

roleSelectorReport: {
        flexDirection: 'row',
        backgroundColor: colors.categoryBackground,
        borderRadius: 12,
        padding: 4,
        marginTop: 20,
        marginBottom: 16,
    },

roleTabActiveReport: {
        backgroundColor: colors.card,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },

roleTabReport: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
    },

roleTabTextReport: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textMuted,
    },

safeAreaReport: {
        flex: 1,
        backgroundColor: colors.background,
    },

scrollContentReport: {
        paddingBottom: 40,
    },

searchBarContainerReport: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },

searchInputReport: {
        flex: 1,
        fontSize: 14,
        color: colors.text,
        paddingVertical: 0,
    },

sectionTitleReport: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 12,
        paddingLeft: 4,
    },

studentCardCriticalReport: {
        borderLeftColor: colors.danger,
    },

studentCardHeaderReport: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },

studentCardReport: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        borderLeftWidth: 4,
    },

studentCardWarningReport: {
        borderLeftColor: colors.warning,
    },

studentInfoReport: {
        flex: 1,
    },

studentMetaReport: {
        fontSize: 12,
        color: colors.textSecondary,
    },

studentNameReport: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 3,
    },

typeSelectorReport: {
        flexDirection: 'row',
        backgroundColor: colors.categoryBackground,
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },

typeTabAbsenceActiveReport: {
        backgroundColor: dangerTint,
    },

typeTabLatenessActiveReport: {
        backgroundColor: warningTint,
    },

typeTabReport: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },

typeTabTextAbsenceActiveReport: {
        color: colors.danger,
    },

typeTabTextLatenessActiveReport: {
        color: colors.warning,
    },

typeTabTextReport: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
    },
}));
};
