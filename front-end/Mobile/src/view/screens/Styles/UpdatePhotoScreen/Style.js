import {Platform, StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

// Estilos de actualización de foto. La vista de cámara y sus controles usan tokens de cámara
// (fijos, sin cambiar con la paleta); los estados y botones usan tokens del tema.
// Usar con createUpdatePhotoStyles(colors).
export const createUpdatePhotoStyles = (colors) => StyleSheet.create(normalizeTypography({
alreadyRegisteredBox: {
        backgroundColor: colors.success + '1A',
        borderLeftWidth: 3,
        borderLeftColor: colors.success,
        padding: 10,
        borderRadius: 6,
        marginTop: 10,
    },

alreadyRegisteredText: {
        fontSize: 13,
        fontWeight: '500'
    },

backButtonContainerUpdatePhoto: {
        marginTop: 20,
    },

cameraContainer: {
        flex: 1,
        position: 'relative',
        backgroundColor: colors.cameraBackground,
    },

cameraHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 12,
        paddingHorizontal: 20,
        zIndex: 3,
    },

cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },

cameraTitle: {
        color: colors.onCamera,
        fontSize: 24,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: {width: 0, height: 2},
        textShadowRadius: 4,
    },

captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: colors.onCamera,
        backgroundColor: colors.cameraBackground + '40',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
        elevation: 20,
    },

captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.onCamera,
    },

captureContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 36 : 24,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 20,
        elevation: 20,
    },

closeButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.cameraBackground + '8C',
        borderWidth: 1,
        borderColor: colors.onCamera + '73',
        justifyContent: 'center',
        alignItems: 'center',
    },

closeButtonText: {
        color: colors.onCamera,
        fontSize: 30,
        fontWeight: '700',
    },

confirmButton: {
        shadowOffset: {
            width: 0,
            height: 4
        },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },

flipButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.cameraBackground + '8C',
        borderWidth: 1,
        borderColor: colors.onCamera + '73',
        justifyContent: 'center',
        alignItems: 'center',
    },

flipButtonText: {
        fontSize: 28,
    },

imageContainerUpdatePhoto: {
        alignItems: "center",
        marginTop: 20,
    },

inputFieldContainerUpdatePhoto: {
        marginBottom: 15,
    },

keyboardAvoidingViewUpdatePhoto: {
        flex: 1,
    },

mainContainerUpdatePhoto: {
        paddingHorizontal: 20,
    },

ovalContainer: {
        width: '76%',
        maxWidth: 320,
        aspectRatio: 0.74,
        borderRadius: 999,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },

ovalInner: {
        width: '92%',
        height: '94%',
        borderRadius: 999,
        borderWidth: 2,
        borderStyle: 'dashed',
    },

overlayContainer: {
        position: 'absolute',
        top: 200,
        left: 0,
        right: 0,
        alignItems: 'center',
    },

previewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 14,
        flex: 1,
        gap: 8,
    },

previewButtonIcon: {
        color: colors.onCamera,
        fontSize: 18,
        fontWeight: '700',
    },

previewButtonText: {
        color: colors.onCamera,
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.3,
    },

previewButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 8,
    },

previewHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 12,
        zIndex: 10,
    },

previewHeaderTitle: {
        color: colors.onCamera,
        fontSize: 24,
        fontWeight: '700',
    },

previewOverlay: {
        backgroundColor: colors.cameraBackground + '52',
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 30 : 30,
        paddingHorizontal: 24,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: colors.onCamera + '14',
        borderBottomWidth: 0,
    },

previewOverlayWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        shadowOffset: {width: 0, height: -10},
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },

previewStatus: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },

previewStatusBox: {
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
    },

previewSubtitle: {
        color: colors.onCamera + 'BF',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
        paddingHorizontal: 10,
    },

previewTitle: {
        color: colors.onCamera,
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 0.3,
    },

registerButtonIconUpdatePhoto: {
        width: 22,
        height: 22,
        tintColor: colors.onPrimary,
        marginRight: 8,
    },

registerButtonSuccessUpdatePhoto: {
        backgroundColor: colors.primary,
    },

registerButtonTextUpdatePhoto: {
        color: colors.onPrimary,
        fontWeight: "bold",
        fontSize: 16,
    },

retakeButton: {
        backgroundColor: colors.onCamera + '1F',
        borderWidth: 1,
        borderColor: colors.onCamera + '33',
    },

scrollViewContentUpdatePhoto: {
        paddingBottom: 40,
    },

statusContainer: {
        backgroundColor: colors.cameraBackground + '99',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20
    },

statusOverlay: {
        marginTop: 28,
        alignItems: 'center',
        paddingHorizontal: 20,
    },

statusTextUpdate: {
        color: colors.onCamera,
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center'
    },
}));
