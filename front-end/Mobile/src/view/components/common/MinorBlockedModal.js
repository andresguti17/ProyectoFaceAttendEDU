import React, {useMemo} from 'react';
import {Modal, ScrollView, Text, TouchableOpacity, View,} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import {createCommonStyles} from "./style/Style";

// Bloqueo visible para un menor de edad cuyo registro no está completo. El menor no puede
// completarlo desde la app: su acudiente acude a la sede, donde el administrador lo registra,
// registra la aceptación de los términos y captura los parámetros faciales.
export default function MinorBlockedModal({ isVisible, step, busy = false, onRecheck, onLeave }) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styleAuth = useMemo(() => createCommonStyles(colors), [colors]);

    return (
        <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onLeave}>
            <View style={[styleAuth.overlayTerminos, { backgroundColor: colors.modalOverlay }]}>
                <View style={[styleAuth.modalContainerTerminos, { backgroundColor: colors.modalBackground }]}>
                    <Text style={[styleAuth.titleTerminos, { color: colors.modalText }]}>{t('minorBlocked.title')}</Text>

                    <ScrollView persistentScrollbar style={styleAuth.contentTerminos} showsVerticalScrollIndicator>
                        <Text style={[styleAuth.paragraphTerminos, { color: colors.modalTextSecondary }]}>
                            {t('minorBlocked.body')} {"\n\n"}
                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>
                                {step === 'GUARDIAN' ? t('minorBlocked.stepGuardian') : t('minorBlocked.stepTerms')} {"\n\n"}
                            </Text>
                            {t('minorBlocked.restriction')}
                        </Text>
                    </ScrollView>

                    <View>
                        <TouchableOpacity
                            style={[styleAuth.buttonTerminos, { backgroundColor: colors.modalButton, opacity: busy ? 0.6 : 1 }]}
                            onPress={onRecheck}
                            disabled={busy}
                            accessibilityRole="button"
                        >
                            <Text style={[styleAuth.buttonTextTerminos, { color: colors.modalButtonText }]}>
                                {busy ? t('minorBlocked.checking') : t('minorBlocked.recheck')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styleAuth.buttonTerminos, { backgroundColor: colors.modalButton }]}
                            onPress={onLeave}
                            accessibilityRole="button"
                        >
                            <Text style={[styleAuth.buttonTextTerminos, { color: colors.modalButtonText }]}>
                                {t('minorBlocked.logout')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
