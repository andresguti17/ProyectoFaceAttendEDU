import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

export const createManageUsersStyles = (colors) => StyleSheet.create(normalizeTypography({
manageUsersActionButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        marginLeft: 8,
    },

manageUsersActionText: {
        fontSize: 13,
        fontWeight: '600',
    },

manageUsersActionsRow: {
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 10,
    },

manageUsersAddButtonText: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 10,
    },

manageUsersBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.overlay,
    },

manageUsersButtonContainer: {
        paddingHorizontal: 20,
        paddingVertical: 15,
    },

manageUsersCancelButton: {
        marginTop: 20,
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },

manageUsersCancelButtonText: {
        color: colors.onPrimary,
        fontSize: 15,
        fontWeight: '600',
    },

manageUsersContainer: {
        flex: 1,
    },

manageUsersDivider: {
        height: 1,
        marginBottom: 8,
        opacity: 0.5,
    },

manageUsersEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },

manageUsersEmptySearch: {
        padding: 20,
        alignItems: 'center',
    },

manageUsersEmptySearchText: {
        fontSize: 13,
    },

manageUsersEmptyText: {
        fontSize: 14,
    },

manageUsersFieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
        marginTop: 12,
        letterSpacing: 0.2,
    },

manageUsersHeader: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },

manageUsersInput: {
        minHeight: 50,
        borderWidth: 1.5,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        marginBottom: 2,
    },

manageUsersItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },

manageUsersItemActions: {
        flexDirection: 'row',
        marginLeft: 10,
    },

manageUsersItemInfo: {
        flex: 1,
    },

manageUsersItemMeta: {
        fontSize: 13,
    },

manageUsersItemName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },

manageUsersKav: {
        flex: 1,
    },

manageUsersList: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

manageUsersModalActions: {
        marginTop: 24,
    },

manageUsersModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
    },

manageUsersOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },

manageUsersResultsList: {
        maxHeight: 260,
        marginTop: 12,
    },

manageUsersSearchItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderRadius: 10,
        marginBottom: 8,
    },

manageUsersSearchItemMeta: {
        fontSize: 13,
    },

manageUsersSearchItemName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },

manageUsersSheet: {
        maxHeight: '85%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },

manageUsersSheetContent: {
        padding: 24,
        paddingBottom: 40,
    },

manageUsersSheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 14,
        opacity: 0.6,
    },

manageUsersTabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
    },

manageUsersTabText: {
        fontSize: 15,
        fontWeight: '600',
    },

manageUsersTabs: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 5,
    },

manageUsersTitle: {
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

