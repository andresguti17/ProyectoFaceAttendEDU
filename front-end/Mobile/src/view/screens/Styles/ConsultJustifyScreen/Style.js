import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de consulta de justificaciones. Todo color sale de los tokens del tema; usar con createConsultJustifyStyles(colors).
export const createConsultJustifyStyles = (colors) => StyleSheet.create(normalizeTypography({
ScrollView: {
        flex: 1,
    },

ScrollViewContent: {
        flexGrow: 1,
        paddingBottom: 30,
    },

activeSectionTab: {
        backgroundColor: colors.primary,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },

cardDate: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.primary,
    },

cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },

cardReason: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },

cardTime: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: "500",
    },

containerValidJustifications: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 20,
    },

dateTimeContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

headerBackImageValidJustifications: {
        width: 26,
        height: 26,
    },

headerTopRowValidJustifications: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
    },

emptyContainer: {
        padding: 40,
        alignItems: "center",
        backgroundColor: colors.categoryBackground,
        borderRadius: 12,
    },

emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: "center",
    },

justificationCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.border,
    },

keyboardview: {
        flex: 1,
    },

listContainer: {
        marginTop: 10,
        marginBottom: 20,
    },

mainTitleValidJustifications: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        paddingTop: Platform.OS === "android" ? 30 : 10,
        marginBottom: 10,
    },

safeAreaWhite: {
        flex: 1,
        backgroundColor: colors.backgroundWhite,
    },

sectionSelector: {
        flexDirection: "row",
        marginTop: 20,
        marginBottom: 20,
        borderRadius: 12,
        backgroundColor: colors.categoryBackground,
        padding: 4,
    },

sectionTab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        borderRadius: 8,
    },

sectionTabText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textSecondary,
    },

sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 15,
    },

statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },

statusText: {
        fontSize: 12,
        fontWeight: "500",
    },

subTitleValidJustifications: {
        fontSize: 16,
        fontWeight: "500",
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: 20,
    },
}));
