import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de justificaciones pendientes. Todo color sale de los tokens del tema;
// usar con createPendingStyles(colors) dentro de un useMemo.
export const createPendingStyles = (colors) => StyleSheet.create(normalizeTypography({
actionRowPending: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        paddingTop: 8,
    },

approveBtnPending: {
        flex: 1,
        backgroundColor: colors.success,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },

approveBtnTextPending: {
        color: colors.onSuccess,
        fontSize: 15,
        fontWeight: '700',
    },

attachmentBoxPending: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
    },

attachmentFileNamePending: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },

attachmentFileSizePending: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },

attachmentIconBoxPending: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },

attachmentIconTextPending: {
        fontSize: 22,
    },

attachmentIndicatorPending: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },

attachmentTextPending: {
        fontSize: 11,
        color: colors.textMuted,
    },

avatarContainerPending: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },

avatarTextPending: {
        fontSize: 17,
        fontWeight: '700',
    },

badgeRowPending: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },

cardDatePending: {
        fontSize: 12,
        color: colors.textMuted,
    },

cardDescriptionPending: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
        marginBottom: 10,
    },

cardFooterPending: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 10,
        marginTop: 2,
    },

cardHeaderInfoPending: {
        flex: 1,
    },

cardHeaderPending: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },

cardMetaPending: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 1,
    },

cardNamePending: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },

cardPending: {
        backgroundColor: colors.card,
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },

containerPending: {
        flex: 1,
    },

descriptionBoxPending: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },

descriptionTextPending: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 21,
    },

detailAvatarLargePending: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },

detailAvatarTextPending: {
        fontSize: 20,
        fontWeight: '800',
    },

detailCardPending: {
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },

detailIconPending: {
        fontSize: 16,
        width: 22,
        textAlign: 'center',
    },

detailKeyPending: {
        fontSize: 13,
        color: colors.textSecondary,
        width: 80,
    },

detailRowLastPending: {
        borderBottomWidth: 0,
    },

detailRowPending: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 10,
    },

detailUserMetaPending: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 1,
    },

detailUserNamePending: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },

detailUserRowPending: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
    },

detailValuePending: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        flex: 1,
    },

emptyContainerPending: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },

emptyIconPending: {
        fontSize: 48,
        marginBottom: 12,
    },

emptySubtitlePending: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: 'center',
    },

emptyTitlePending: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },

filterChipPending: {
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },

filterChipTextPending: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
    },

filterRowPending: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        paddingBottom: 12,
        gap: 8,
    },

headerTopRowPending: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },

headerBackImagePending: {
        width: 26,
        height: 26,
    },

headerPending: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: colors.background,
    },

headerSubtitlePending: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },

headerTitlePending: {
        fontSize: 26,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },

listContentPending: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },

modalCloseBtnPending: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },

modalCloseTextPending: {
        fontSize: 16,
        color: colors.textSecondary,
        lineHeight: 18,
    },

modalHandlePending: {
        width: 40,
        height: 4,
        backgroundColor: colors.textMuted,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },

modalHeaderPending: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },

modalOverlayPending: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },

modalScrollPending: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },

modalSheetPending: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },

modalTitlePending: {
        fontSize: 17,
        fontWeight: '800',
        color: colors.text,
    },

rejectBtnPending: {
        flex: 1,
        backgroundColor: colors.danger,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },

rejectBtnTextPending: {
        color: colors.onDanger,
        fontSize: 15,
        fontWeight: '700',
    },

resultsBadgePending: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 1,
    },

resultsBadgeTextPending: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.onPrimary,
    },

resultsRowPending: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 10,
        gap: 6,
    },

resultsTextPending: {
        fontSize: 13,
        color: colors.textMuted,
    },

roleBadgePending: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
    },

roleBadgeTextPending: {
        fontSize: 11,
        fontWeight: '600',
    },

safeAreaPending: {
        flex: 1,
        backgroundColor: colors.background,
    },

sectionLabelPending: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textMuted,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 4,
    },

typeBadgePending: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
    },

typeBadgeTextPending: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

viewButtonPending: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 4,
    },

viewButtonTextPending: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.onPrimary,
    },
}));
