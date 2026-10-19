import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos del dashboard. Todo color sale de los tokens del tema; usar con createDashboardStyles(colors).
export const createDashboardStyles = (colors) => StyleSheet.create(normalizeTypography({
actionDescription: {
        fontSize: 11,
        color: colors.textSecondary,
        textAlign: "center",
    },

actionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
    },

actionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
        textAlign: "center",
        marginBottom: 4,
    },

adminName: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 4,
    },

attendanceIndicator: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

bottomSpace: {
        height: 90,
    },

container: {
        flex: 1,
        paddingTop: 15,
        marginHorizontal: 20
    },

dataBar: {
        flex: 1,
    },

date: {
        fontSize: 12,
        color: colors.textMuted,
    },

greeting: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 4,
    },

header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginTop: 20,
        marginBottom: 20,
    },

indicatorDetails: {
        alignItems: "center",
    },

indicatorHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },

indicatorText: {
        fontSize: 12,
        color: colors.textSecondary,
    },

leftContent: {
        flex: 1,
    },

novedadCard: {
        flexDirection: "row",
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },

novedadContent: {
        flex: 1,
    },

novedadDescripcion: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },

novedadIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },

novedadTiempo: {
        fontSize: 10,
        color: colors.textMuted,
    },

novedadTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 2,
    },

novedadesSection: {
        marginBottom: 20,
    },

percentageText: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.success,
    },

progressBar: {
        height: 8,
        backgroundColor: colors.progressBackground,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 8,
    },

progressFill: {
        height: "100%",
        backgroundColor: colors.success,
        borderRadius: 4,
    },

quickActionCard: {
        width: "48%",
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

quickActionsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: 25,
    },

recentInfo: {
        flex: 1,
    },

recentItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },

recentName: {
        fontSize: 17,
        fontWeight: "500",
        color: colors.text,
    },

recentSection: {
        marginBottom: 25,
    },

recentTime: {
        fontSize: 15,
        color: colors.textMuted,
        marginTop: 2,
    },

safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },

sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 15,
    },

sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 15,
    },

sectionTitleAdmin: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 6,
        paddingLeft: 4,
    },

seeAllText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: "500",
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
}));
