import React, {useMemo} from 'react';
import {ActivityIndicator, SafeAreaView, Text, TouchableOpacity, View,} from 'react-native';
import {CameraView} from 'expo-camera';
import {useIsFocused} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import CustomLogo from '../components/common/logo';
import CustomAlert from '../components/common/CustomAlert';
import BackButton from '../components/common/BackButton';
import {createRegisterFaceStyles} from './Styles/RegisterFace/Style';
import {useRegisterFaceScreenViewModel} from '../../viewmodels/useRegisterFaceScreenViewModel';


export default function RegisterFace() {
    const isFocused = useIsFocused();
    const {t} = useTranslation();
    const {colors} = useTheme();
    const styles = useMemo(() => createRegisterFaceStyles(colors), [colors]);

    // Tono del subtítulo según el estado del registro.
    const statusColors = {info: colors.textSecondary, ok: colors.success, error: colors.danger};

    const {
        title,
        actionLabel,
        personName,
        subtitle,
        status,
        permissionLoading,
        permissionGranted,
        requestPermission,
        cameraRef,
        cameraReady,
        pictureSize,
        handleCameraReady,
        handleMountError,
        busy,
        livenessAction,
        livenessProgress,
        handleRegister,
        handleBack,
        alertConfig,
        hideAlert,
    } = useRegisterFaceScreenViewModel();

    const progressLabel = livenessProgress
        ? t('faceCapture.gestureProgress', {
            current: Math.min(livenessProgress.done + 1, livenessProgress.total),
            total: livenessProgress.total,
        })
        : null;

    return (
        <SafeAreaView style={styles.safeAreaRegisterFace}>
            <View style={styles.registerFaceContainer}>
                <View style={styles.registerFaceHeader}>
                    <BackButton onPress={handleBack} />
                    <Text style={styles.registerFaceTitle}>{title}</Text>
                    <CustomLogo size="small" rounded={true} backgroundColor={colors.cameraBackground} marginBottom={-2}/>
                </View>

                {personName ? <Text style={styles.registerFacePerson}>{personName}</Text> : null}

                <Text style={[styles.registerFaceSubtitle, {color: statusColors[status.tone] || statusColors.info}]}>
                    {subtitle}
                </Text>

                {permissionLoading ? (
                    <View style={styles.cameraWrapper}>
                        <ActivityIndicator color={colors.primary}/>
                    </View>
                ) : !permissionGranted ? (
                    <View style={styles.cameraWrapper}>
                        <Text style={styles.registerFacePermissionText}>
                            {t('registerFace.permissionText')}
                        </Text>
                        <TouchableOpacity
                            style={styles.registerFacePermissionButton}
                            onPress={requestPermission}
                        >
                            <Text style={styles.registerFacePermissionButtonText}>{t('registerFace.allowCamera')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : isFocused ? (
                    <View style={styles.cameraWrapper}>
                        <CameraView
                            ref={cameraRef}
                            facing="front"
                            pictureSize={pictureSize}
                            style={styles.cameraPreview}
                            onCameraReady={handleCameraReady}
                            onMountError={handleMountError}
                        />
                        <View pointerEvents="none" style={styles.faceOval}/>
                        {livenessAction ? (
                            <View pointerEvents="none" style={styles.livenessBanner}>
                                <Text style={styles.livenessLabel}>{t('faceCapture.currentInstruction')}</Text>
                                <Text style={styles.livenessAction}>{livenessAction}</Text>
                                {progressLabel ? <Text style={styles.livenessProgress}>{progressLabel}</Text> : null}
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <View style={styles.registerFaceActions}>
                    <TouchableOpacity
                        style={[styles.captureButtonRegister, (!cameraReady || busy) && {opacity: 0.6}]}
                        onPress={handleRegister}
                        disabled={!cameraReady || busy}
                    >
                        {busy ? (
                            <ActivityIndicator color={colors.onPrimary}/>
                        ) : (
                            <Text style={styles.captureButtonText}>
                                {cameraReady ? actionLabel : t('registerFace.startingCamera')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                type={alertConfig.type}
                onClose={hideAlert}
            />
        </SafeAreaView>
    );
}
