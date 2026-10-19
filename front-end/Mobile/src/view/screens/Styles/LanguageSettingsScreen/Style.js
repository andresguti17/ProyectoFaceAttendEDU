import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de Ajustes de idioma y apariencia. Dependen de los tokens del tema
// (ThemeContext.colors) para que cada paleta se refleje en la pantalla.
export const createLanguageSettingsStyles = (colors) => StyleSheet.create(normalizeTypography({
    languageSettingsCheckmark: {
        fontSize: 18,
        color: colors.primary,
        fontWeight: 'bold',
    },

    languageSettingsOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderColor: colors.border,
        borderRadius: 8,
        marginBottom: 10,
    },

    languageSettingsOptionText: {
        fontSize: 16,
    },

    languageSettingsSafeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },

    languageSettingsSubtitle: {
        fontSize: 16,
        marginBottom: 30,
        textAlign: 'center',
        color: colors.textSecondary,
    },

    languageSettingsTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
        color: colors.text,
    },

    secondaryButton: {
        alignItems: 'center',
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
}));
