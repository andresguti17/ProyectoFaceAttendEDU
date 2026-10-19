import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de configuración escolar. Todo color sale de los tokens del tema; usar con createSchoolConfigStyles(colors).
export const createSchoolConfigStyles = (colors) => {
const dangerTint = colors.danger + '1A';
return StyleSheet.create(normalizeTypography({
actionButtonsContainerSchoolConfig: {
        marginTop: 24,
        marginBottom: 30,
        gap: 12,
    },

cancelButtonSchoolConfig: {
        backgroundColor: colors.card,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: colors.border,
    },

cancelButtonTextSchoolConfig: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },

containerSchoolConfig: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
    },

countryDialCodeSchoolConfig: {
        fontSize: 14,
        color: colors.textSecondary,
    },

countryOptionSchoolConfig: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

countryOptionTextSchoolConfig: {
        fontSize: 15,
        color: colors.text,
    },

countryPickerSchoolConfig: {
        justifyContent: 'center',
        minHeight: 52,
    },

countryPickerTextSchoolConfig: {
        fontSize: 14,
        color: colors.text,
    },

formGroupSchoolConfig: {
        marginBottom: 16,
    },

formSectionSchoolConfig: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },

formSectionTitleSchoolConfig: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 14,
        paddingBottom: 12,
        borderBottomWidth: 2,
        borderBottomColor: colors.border,
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

headerSchoolConfig: {
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

headerTitleSchoolConfig: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
        textAlign: 'center',
    },

inputErrorMessageSchoolConfig: {
        fontSize: 12,
        color: colors.danger,
        marginTop: 6,
        fontWeight: '500',
    },

inputFieldDisabledSchoolConfig: {
        backgroundColor: colors.categoryBackground,
        color: colors.textMuted,
    },

inputFieldErrorSchoolConfig: {
        borderColor: colors.danger,
        backgroundColor: dangerTint,
    },

inputFieldSchoolConfig: {
        backgroundColor: colors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },

inputLabelRequiredSchoolConfig: {
        color: colors.danger,
        marginLeft: 4,
    },

inputLabelSchoolConfig: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },

loadingOverlaySchoolConfig: {
        backgroundColor: colors.overlay,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        gap: 8,
    },

loadingTextSchoolConfig: {
        fontSize: 14,
        color: colors.onCamera,
        fontWeight: '500',
    },

mainContentSchoolConfig: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },

modalActionsSchoolConfig: {
        gap: 10,
    },

modalCancelButtonSchoolConfig: {
        backgroundColor: colors.categoryBackground,
        borderRadius: 12,
        paddingVertical: 13,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },

modalCancelButtonTextSchoolConfig: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
    },

modalConfirmButtonSchoolConfig: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },

modalConfirmButtonTextSchoolConfig: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.onPrimary,
    },

modalMessageSchoolConfig: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
        backgroundColor: colors.inputBackground,
        borderRadius: 10,
        padding: 12,
    },

modalOverlaySchoolConfig: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },

modalSheetSchoolConfig: {
        backgroundColor: colors.modalBackground,
        borderRadius: 20,
        padding: 24,
        width: '85%',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 10},
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 8,
    },

modalSubtitleSchoolConfig: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },

modalTitleSchoolConfig: {
        fontSize: 19,
        fontWeight: '700',
        color: colors.modalText,
        marginBottom: 8,
        textAlign: 'center',
    },

pickerContainerSchoolConfig: {
        backgroundColor: colors.inputBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },

quickInfoItemSchoolConfig: {
        alignItems: 'center',
        flex: 1,
    },

quickInfoLabelSchoolConfig: {
        fontSize: 11,
        color: colors.textMuted,
        textAlign: 'center',
    },

quickInfoRowSchoolConfig: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },

quickInfoValueSchoolConfig: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },

safeAreaSchoolConfig: {
        flex: 1,
        backgroundColor: colors.background,
    },

saveButtonSchoolConfig: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        shadowColor: colors.primary,
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },

saveButtonTextSchoolConfig: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.onPrimary,
    },

schoolInfoCardSchoolConfig: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.border,
    },

schoolLogoContainerSchoolConfig: {
        width: 100,
        height: 100,
        borderRadius: 16,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: colors.border,
    },

schoolNameSchoolConfig: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 6,
    },

scrollContentSchoolConfig: {
        paddingBottom: 40,
    },

sectionTabActiveSchoolConfig: {
        backgroundColor: colors.card,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },

sectionTabSchoolConfig: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
    },

sectionTabTextActiveSchoolConfig: {
        color: colors.text,
    },

sectionTabTextSchoolConfig: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
    },

sectionTabsSchoolConfig: {
        flexDirection: 'row',
        backgroundColor: colors.categoryBackground,
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },

textAreaSchoolConfig: {
        minHeight: 100,
        textAlignVertical: 'top',
        paddingTop: 12,
    },

toggleDescriptionSchoolConfig: {
        fontSize: 12,
        color: colors.textMuted,
    },

toggleLabelContainerSchoolConfig: {
        flex: 1,
    },

toggleLabelSchoolConfig: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },

toggleRowSchoolConfig: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },

validationCheckmarkSchoolConfig: {
        position: 'absolute',
        right: 12,
        top: '50%',
        marginTop: -10,
        fontSize: 18,
        color: colors.success,
    },

validationErrorIconSchoolConfig: {
        position: 'absolute',
        right: 12,
        top: '50%',
        marginTop: -10,
        fontSize: 18,
        color: colors.danger,
    },
}));
};
