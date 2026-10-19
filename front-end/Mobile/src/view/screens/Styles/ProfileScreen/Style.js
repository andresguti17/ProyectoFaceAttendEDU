import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos del perfil. Todo color sale de los tokens del tema; usar con createProfileStyles(colors).
export const createProfileStyles = (colors) => StyleSheet.create(normalizeTypography({
ScrollViewContent: {
        flexGrow: 1,
        paddingBottom: 30,
    },

buttonContainer: {
        marginBottom: Platform.OS === 'ios' ? 60 : 130,
        marginHorizontal: 20
    },

container: {
        flex: 1,
        paddingTop: 15,
        marginHorizontal: 20
    },

infoFieldContainerProfile: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },

infoFieldLabelProfile: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },

infoFieldValueProfile: {
        fontSize: 13,
        fontWeight: '400',
        maxWidth: '55%',
        textAlign: 'right',
    },

profileHeaderSectionProfile: {
        alignItems: 'center',
        marginBottom: 28,
        paddingBottom: 24,
    },

profileSettingsButtonProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },

profileSettingsSubtitleProfile: {
        fontSize: 12,
        marginTop: 2,
    },

profileSettingsTitleProfile: {
        fontSize: 15,
        fontWeight: '600',
    },

roleBadgeDotProfile: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },

roleBadgeProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
    },

roleBadgeTextProfile: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

safeAreaWhite: {
        flex: 1,
        backgroundColor: colors.card,
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

schoolLogoSchoolConfig: {
        fontSize: 48,
    },

sectionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },

sectionBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },

sectionTitleAccentProfile: {
        width: 4,
        height: 18,
        borderRadius: 2,
        marginRight: 8,
    },

sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },

sectionTitleMenuProfile: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
        letterSpacing: 0.1,
    },

settingsChevronProfile: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },

statItemProfile: {
        alignItems: 'center',
        minWidth: 60,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 12,
    },

statLabelProfile: {
        fontSize: 10,
        marginTop: 3,
        textAlign: 'center',
        fontWeight: '500',
    },

statValueProfile: {
        fontSize: 20,
        fontWeight: '800',
    },

userNameProfile: {
        fontSize: 26,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
}));

