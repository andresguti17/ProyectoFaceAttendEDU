import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de asistencia. Todo color sale de los tokens del tema; usar con createDisplayingAttendanceStyles(colors).
export const createDisplayingAttendanceStyles = (colors) => StyleSheet.create(normalizeTypography({
safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    // ── Contenedor principal ──
    mainContainer: {
        flex: 1,
        marginTop: 10,
    },
    tabsWrap: {
        marginHorizontal: 20,
    },
    // ── Filtros ──
    filtersRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 10,
        marginHorizontal: 20,
        marginTop: 20,
    },
    searchBox: {
        flex: 2,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderRadius: 10,
        paddingHorizontal: 12,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 14,
    },
    clearText: {
        fontSize: 16,
        fontWeight: "700",
    },
    searchIcon: {
        width: 16,
        height: 16,
    },
    dateButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 6,
    },
    dateButtonAdmin: {
        flex: 1.2,
    },
    dateText: {
        flex: 1,
        fontSize: 13,
    },
    // ── Lista ──
    listStyle: {
        flex: 1,
    },
    listContent: {
        paddingTop: 4,
        paddingBottom: 20,
    },
    emptyWrap: {
        alignItems: "center",
        paddingVertical: 50,
    },
    emptyText: {
        fontSize: 14,
        textAlign: "center",
    },
    listFooterSpace: {},
    // ── DetailRow ──
    detailRow: {
        flexDirection: "row",
        alignItems: "stretch",
        paddingVertical: 10,
        borderBottomWidth: 1,
        gap: 12,
    },
    detailRowBody: {
        flex: 1,
    },
    detailRowLabel: {
        fontSize: 11,
        marginBottom: 2,
    },
    detailRowValue: {
        fontSize: 14,
        fontWeight: "600",
    },
    // ── SectionLabel ──
    sectionLabel: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.8,
        marginTop: 20,
        marginBottom: 4,
        textTransform: "uppercase",
    },
    // ── Modales de detalle ──
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
    },
    modalOverlayLight: {
        flex: 1,
        backgroundColor: colors.overlay,
    },
    bottomSheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 24,
        maxHeight: "84%",
    },
    bottomSheetTall: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 24,
        maxHeight: "88%",
    },
    sheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: "center",
        marginTop: 12,
        marginBottom: 20,
    },
    sheetScrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    sheetHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginBottom: 24,
    },
    avatarLarge: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
    },
    avatarLargeText: {
        fontSize: 20,
        fontWeight: "700",
    },
    headerName: {
        fontSize: 18,
        fontWeight: "700",
    },
    headerMeta: {
        fontSize: 13,
        marginTop: 2,
    },
    headerBody: {
        flex: 1,
    },
    sheetCloseButton: {
        marginHorizontal: 24,
        marginTop: 8,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
    },
    sheetCloseText: {
        fontSize: 15,
        fontWeight: "600",
        borderWidth: 0.2,
    },
    sheetCloseTextPlain: {
        fontSize: 15,
        fontWeight: "600",
    },
    // ── Tarjeta de estado (modal estudiante) ──
    statusCard: {
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginBottom: 24,
        borderWidth: 1,
    },
    statusCardBody: {
        flex: 1,
    },
    statusCardTitle: {
        fontSize: 17,
        fontWeight: "700",
    },
    statusCardCode: {
        fontSize: 12,
        marginTop: 2,
    },
    approvalRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    approvalBody: {
        flex: 1,
    },
    approvalLabel: {
        fontSize: 11,
        marginBottom: 6,
    },
    approvalBadge: {
        alignSelf: "flex-start",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
    },
    approvalBadgeText: {
        fontSize: 13,
        fontWeight: "700",
    },
    warnBox: {
        marginTop: 20,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
    },
    warnTitle: {
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 4,
    },
    warnMsg: {
        fontSize: 12,
    },
    // ── Tarjeta docente ──
    teacherCard: {
        borderRadius: 14,
        marginHorizontal: 20,
        marginBottom: 10,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderLeftWidth: 4,
    },
    teacherAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        justifyContent: "center",
        alignItems: "center",
    },
    teacherAvatarText: {
        fontSize: 15,
        fontWeight: "700",
    },
    teacherBody: {
        flex: 1,
    },
    teacherName: {
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 2,
    },
    teacherMeta: {
        fontSize: 12,
    },
    teacherSub: {
        fontSize: 11,
        marginTop: 2,
    },
    infoButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    infoIcon: {
        width: 18,
        height: 18,
    },
    // ── Tarjeta estudiante ──
    myCard: {
        borderRadius: 14,
        marginHorizontal: 20,
        marginBottom: 10,
        padding: 14,
        borderWidth: 1,
    },
    myCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    myCardDateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    myCardDate: {
        fontSize: 13,
        fontWeight: "700",
    },
    myCardTime: {
        fontSize: 12,
    },
    myCardBody: {
        flexDirection: "row",
        gap: 8,
        paddingTop: 10,
        borderTopWidth: 1,
    },
    myCardField: {
        flex: 1,
    },
    myCardFieldLabel: {
        fontSize: 11,
        marginBottom: 2,
    },
    myCardFieldValue: {
        fontSize: 14,
        fontWeight: "600",
    },
    myCardFieldValuePlain: {
        fontSize: 14,
    },
    justifiedBadge: {
        alignSelf: "flex-end",
        borderRadius: 20,
        paddingHorizontal: 8,
    },
    justifiedBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: colors.info,
    },
    // ── Modal iOS date picker ──
    iosSheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        paddingBottom: 34,
    },
    iosHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 14,
    },
    iosActionsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    iosActionText: {
        fontSize: 16,
        fontWeight: "600",
    },
}));
