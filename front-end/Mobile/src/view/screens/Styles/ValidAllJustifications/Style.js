import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de todas las justificaciones validadas. Todo color sale de los tokens del tema; usar con createValidAllJustificationsStyles(colors).
export const createValidAllJustificationsStyles = (colors) => StyleSheet.create(normalizeTypography({
validAllJustificationsBackButton: {
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
        borderWidth: 1,
    },

validAllJustificationsBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },

validAllJustificationsBadgeText: {
        color: colors.onPrimary,
        fontSize: 14,
        fontWeight: '700',
    },

validAllJustificationsCategoryCount: {
        fontSize: 12,
    },

validAllJustificationsCategoryHeader: {
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

validAllJustificationsCategorySection: {
        marginBottom: 24,
    },

validAllJustificationsCategoryTitle: {
        fontSize: 15,
        fontWeight: '700',
    },

validAllJustificationsContainer: {
        flex: 1,
    },

validAllJustificationsEmptyDescription: {
        fontSize: 14,
        textAlign: 'center',
    },

validAllJustificationsEmptyIcon: {
        fontSize: 40,
        marginBottom: 16,
    },

validAllJustificationsEmptyState: {
        alignItems: 'center',
        marginTop: 60,
    },

validAllJustificationsEmptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },

validAllJustificationsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },

validAllJustificationsItemBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },

validAllJustificationsItemBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },

validAllJustificationsItemCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderLeftWidth: 3,
    },

validAllJustificationsItemDocText: {
        fontSize: 12,
    },

validAllJustificationsItemFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

validAllJustificationsItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },

validAllJustificationsItemNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },

validAllJustificationsItemNumberText: {
        color: colors.onPrimary,
        fontSize: 13,
        fontWeight: '700',
    },

validAllJustificationsItemSeparator: {
        height: 1,
        marginBottom: 10,
    },

validAllJustificationsItemType: {
        fontSize: 15,
        fontWeight: '700',
        flex: 1,
    },

validAllJustificationsSafeArea: {
        flex: 1,
    },

validAllJustificationsScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },

validAllJustificationsSeparator: {
        height: 1,
        marginHorizontal: 20,
        marginBottom: 8,
    },

validAllJustificationsTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
}));
