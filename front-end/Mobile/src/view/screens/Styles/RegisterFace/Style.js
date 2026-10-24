import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de registro facial. La vista de cámara y su instrucción usan tokens de cámara (fijos);
// botones, textos y superficies usan tokens del tema. Usar con createRegisterFaceStyles(colors).
export const createRegisterFaceStyles = (colors) => StyleSheet.create(normalizeTypography({
cameraPreview: {
        width: '100%',
        height: '100%',
    },

cameraWrapper: {
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: colors.cameraBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },

captureButtonRegister: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 50,
    },

captureButtonText: {
        color: colors.onPrimary,
        fontSize: 16,
        fontWeight: '600',
    },

faceOval: {
        position: 'absolute',
        left: '16%',
        top: '11%',
        width: '68%',
        height: '78%',
        borderRadius: '50%',
        borderWidth: 2,
        borderColor: colors.onCamera + 'E6',
    },

livenessBanner: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: colors.cameraBackground + 'C7',
        alignItems: 'center',
    },

livenessLabel: {
        color: colors.onCamera + 'B3',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    },

livenessAction: {
        color: colors.onCamera,
        fontSize: 18,
        fontWeight: '700',
        marginTop: 4,
        textAlign: 'center',
    },

livenessProgress: {
        color: colors.onCamera + 'D9',
        fontSize: 12,
        marginTop: 4,
    },

registerFacePerson: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
        marginTop: 10,
    },

registerFaceActions: {
        marginTop: 25,
        gap: 10,
    },

registerFaceContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },

registerFaceFooter: {
        paddingBottom: 20,
    },

registerFaceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
    },

registerFacePermissionButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: colors.primary,
    },

registerFacePermissionButtonText: {
        color: colors.onPrimary,
        fontWeight: '600',
    },

registerFacePermissionText: {
        color: colors.onCamera,
        textAlign: 'center',
        paddingHorizontal: 24,
        marginBottom: 12,
    },

registerFaceSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginVertical: 14,
    },

registerFaceTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
    },

safeAreaRegisterFace: {
        flex: 1,
        backgroundColor: colors.backgroundWhite,
    },

secondaryButtonRegister: {
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: 'center',
    },

secondaryButtonText: {
        color: colors.primary,
        fontWeight: '600',
    },
}));
