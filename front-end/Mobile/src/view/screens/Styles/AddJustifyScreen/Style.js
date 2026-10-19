import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de agregar justificación. Todo color sale de los tokens del tema; usar con createAddJustifyStyles(colors).
export const createAddJustifyStyles = (colors) => StyleSheet.create(normalizeTypography({
ScrollView: {
        flex: 1,
    },

ScrollViewContent: {
        flexGrow: 1,
        paddingBottom: 30,
    },

buttonContainer: {
        marginBottom: Platform.OS === 'ios' ? 60 : 130,
        marginHorizontal: 20
    },

containerAddJustification: {
        flex: 1,
        marginTop: 25,
        paddingHorizontal: 20,
        paddingVertical: 20,
        paddingTop: Platform.OS === "android" ? 50 : 10,
    },

descriptionText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 20,
    },

inputLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 10,
        marginTop: 5,
    },

keyboardview: {
        flex: 1,
    },

mainTitleAddJustification: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        textAlign: "center",
        marginTop: 20,
        marginBottom: 10,
    },

safeAreaWhite: {
        flex: 1,
        backgroundColor: colors.backgroundWhite,
    },

secondaryButton: {
        alignItems: "center",
        paddingVertical: 12,
        marginTop: 10,
        marginBottom: 30,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
    },

secondaryButtonText: {
        color: colors.primary,
        fontWeight: '600',
    },

spacer: {
        flex: 1,
        minHeight: 20,
    },

supportedFormats: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 8,
        textAlign: "center",
    },

textArea: {
        minHeight: 120,
        textAlignVertical: 'top',
    },

textInput: {
        backgroundColor: colors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: colors.text,
        marginBottom: 20,
    },

typeButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        minWidth: '30%',
        alignItems: 'center',
    },

typeButtonText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },

typeSelector: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 5,
    },

uploadButton: {
        backgroundColor: colors.primaryLight,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.primary,
        borderstyle: "dashed",
        marginBottom: 10,
    },

uploadButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.primary,
    },
}));
