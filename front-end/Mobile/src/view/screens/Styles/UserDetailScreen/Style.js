import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

export const createUserDetailStyles = (colors) => StyleSheet.create(normalizeTypography({
userDetailContainer: {
        flex: 1,
    },

userDetailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        marginTop: 16,
    },

userDetailTitle: {
        fontSize: 22,
        fontWeight: '700',
        flex: 1,
    },

userDetailContent: {
        padding: 20,
        gap: 16,
    },

userDetailCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
    },

userDetailProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },

userDetailAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },

userDetailAvatarText: {
        color: colors.onPrimary,
        fontSize: 20,
        fontWeight: '700',
    },

userDetailName: {
        fontSize: 17,
        fontWeight: '700',
    },

userDetailMeta: {
        fontSize: 13,
        marginTop: 2,
    },

userDetailBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },

userDetailBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },

userDetailBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },

userDetailSectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 10,
    },

userDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        gap: 10,
    },

userDetailRowLabel: {
        fontSize: 13,
        width: 90,
    },

userDetailRowValue: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },

userDetailAttendanceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },

userDetailAttendanceValue: {
        fontSize: 18,
        fontWeight: '800',
    },

userDetailBarTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },

userDetailBarFill: {
        height: '100%',
        borderRadius: 4,
    },

userDetailHint: {
        fontSize: 12,
        marginTop: 8,
    },

userDetailBiometricItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },

userDetailButton: {
        marginTop: 12,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },

userDetailButtonText: {
        color: colors.onPrimary,
        fontSize: 15,
        fontWeight: '600',
    },

userDetailLoading: {
        paddingVertical: 24,
        alignItems: 'center',
        gap: 8,
    },
}));

