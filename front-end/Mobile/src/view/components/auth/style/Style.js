import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de autenticación y de modales de contraseña/registro. Todo color sale de
// los tokens del tema (ThemeContext.colors); usar con createAuthStyles(colors).
export const createAuthStyles = (colors) => StyleSheet.create(normalizeTypography({
    /* ── CodeInput ───────────────────────────────────────────── */
    codeInputRow: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    codeDigit: {
        width: 44,
        height: 52,
        marginHorizontal: 4,
        borderWidth: 2,
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: '700',
    },

    /* ── PasswordRequirement ─────────────────────────────────── */
    passwordReqRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 3,
    },
    passwordReqIcon: {
        fontSize: 14,
        width: 16,
        marginRight: 8,
        textAlign: 'center',
    },
    passwordReqText: {
        fontSize: 13,
    },

    /* ── PasswordModal ───────────────────────────────────────── */
    modalWrapper: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        padding: 20,
    },
    modalScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    passwordModalCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: {width: 0, height: 4},
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {elevation: 8},
        }),
    },
    passwordModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    passwordModalDescription: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 6,
    },
    passwordModalDivider: {
        height: 1,
        marginVertical: 14,
    },
    passwordFieldWrapper: {
        marginBottom: 12,
    },
    passwordModalInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
    },
    eyeButton: {
        position: 'absolute',
        right: 12,
        top: 12,
        padding: 4,
    },
    strengthBarContainer: {
        marginBottom: 10,
    },
    strengthBarTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.progressBackground,
        overflow: 'hidden',
    },
    strengthBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    strengthLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    passwordReqContainer: {
        marginBottom: 12,
    },
    passwordMatchIndicator: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    passwordModalErrorRow: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
    },
    passwordModalError: {
        fontSize: 13,
    },
    passwordModalButtons: {
        alignItems: 'center',
        marginTop: 8,
    },
    passwordModalCancelButton: {
        marginTop: 12,
        padding: 8,
    },
    passwordModalCancelText: {
        fontSize: 14,
        fontWeight: '600',
    },

    /* ── SuccessScreen ───────────────────────────────────────── */
    safeAreaWhite: {
        flex: 1,
        backgroundColor: colors.background,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
    },
    successMessage: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 12,
    },

    /* ── Botón primario (compartido) ─────────────────────────── */
    recoveryPrimaryButton: {
        borderRadius: 12,
        paddingVertical: 14,
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recoveryPrimaryButtonText: {
        color: colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },

    dangerButton: {
        backgroundColor: colors.danger,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        width: '100%',
    },
    dangerButtonContainer: {
        width: '100%',
    },
    dangerButtonText: {
        color: colors.onDanger,
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    buttonDisabled: {
        backgroundColor: colors.tabInactive,
        opacity: 0.6,
    },
    buttonPrimary: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
        borderWidth: 1,
        width: "100%",
        alignSelf: 'center',
        textAlign: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    buttonDisabledPrimary: {
        textAlign: 'center',
        opacity: 0.6,
    },
    textPrimaryButton: {
        fontSize: 16,
        fontWeight: '600',
    },
    overlayRegister: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainerRegister: {
        width: '100%',
        maxHeight: '80%',
        backgroundColor: colors.modalBackground,
        borderRadius: 14,
        padding: 20,
    },
    titleRegister: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 16,
        textAlign: 'center',
    },
    contentRegister: {
        marginBottom: 20,
    },
    paragraphRegister: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 14
    },
    buttonRegister: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonTextRegister: {
        color: colors.onPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
}));
