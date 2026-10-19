import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

export const createManageEnvironmentStyles = (colors) => StyleSheet.create(normalizeTypography({
manageEnviromentButtonContainer: {
        paddingHorizontal: 20,
    },

manageEnvironmentActionButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        marginLeft: 8,
    },

manageEnvironmentActionText: {
        fontSize: 13,
        fontWeight: '600',
    },

manageEnvironmentActionsRow: {
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 10,
    },

manageEnvironmentBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.overlay,
    },

manageEnvironmentCancelButton: {
        marginTop: 20,
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },

manageEnvironmentCancelButtonText: {
        color: colors.onPrimary,
        fontSize: 15,
        fontWeight: '600',
    },

manageEnvironmentContainer: {
        flex: 1,
    },

manageEnvironmentDivider: {
        height: 1,
        marginBottom: 8,
        opacity: 0.5,
    },

manageEnvironmentEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },

manageEnvironmentEmptyText: {
        fontSize: 14,
    },

manageEnvironmentFieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
        marginTop: 12,
        letterSpacing: 0.2,
    },

manageEnvironmentHeader: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },

manageEnvironmentInput: {
        minHeight: 50,
        borderWidth: 1.5,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        marginBottom: 2,
    },

manageEnvironmentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },

manageEnvironmentItemActions: {
        flexDirection: 'row',
        marginLeft: 10,
    },

manageEnvironmentItemInfo: {
        flex: 1,
    },

manageEnvironmentItemMeta: {
        fontSize: 13,
    },

manageEnvironmentItemName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },

manageEnvironmentKav: {
        flex: 1,
    },

manageEnvironmentList: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

manageEnvironmentModalActions: {
        marginTop: 24,
    },

manageEnvironmentModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
    },

manageEnvironmentOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },

manageEnvironmentSearchContainer: {
        marginHorizontal: 20,
        marginTop: 15,
    },

manageEnvironmentSheet: {
        maxHeight: '85%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },

manageEnvironmentSheetContent: {
        padding: 24,
        paddingBottom: 40,
    },

manageEnvironmentSheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 14,
        opacity: 0.6,
    },

manageEnvironmentTitle: {
        fontSize: 28,
        fontWeight: '700',
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
}));

