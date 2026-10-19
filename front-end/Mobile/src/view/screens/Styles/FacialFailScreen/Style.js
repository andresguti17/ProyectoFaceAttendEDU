import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

export const createFacialFailStyles = (colors) => StyleSheet.create(normalizeTypography({
buttonContainer: {
        marginBottom: Platform.OS === 'ios' ? 60 : 130,
        marginHorizontal: 20
    },

container: {
        flex: 1,
        paddingTop: 15,
        marginHorizontal: 20
    },

headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        marginTop: 10,
    },

keyboardview: {
        flex: 1,
    },

mainTitle: {
        fontSize: 28,
        fontWeight: "800",
        flex: 1,
        textAlign: "left",
    },

optionCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },

optionDescription: {
        fontSize: 14,
        lineHeight: 22,
        fontStyle: "italic",
    },

optionTitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
        letterSpacing: 0.3,
    },

recommendationSubtitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
    },

recommendationText: {
        fontSize: 14,
        lineHeight: 22,
        textAlign: "left",
    },

recommendationsTitle: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 16,
        marginTop: 20,
        textAlign: "left",
    },

safeAreaFacialFail: {
        flex: 1,
        backgroundColor: colors.background,
        marginTop: Platform.OS === 'android' ? 25 : 0
    },

scrollContent: {
        flexGrow: 1,
    },

subtitle: {
        fontSize: 16,
        fontWeight: "400",
        lineHeight: 24,
        marginBottom: 24,
        opacity: 0.8,
    },
}));

