import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';
import { createCommonStyles } from "./style/Style";

// Secciones del texto vigente (termsModal.s1Title/s1Text ... s14): el mismo documento que la web.
const SECTIONS = Array.from({ length: 14 }, (_, i) => i + 1);

// Con onAccept es la firma del adulto (primer ingreso o versión nueva); sin él, solo lectura.
export default function TerminosModal({ isVisible, onClose, onAccept, busy = false, error = null }) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styleAuth = useMemo(() => createCommonStyles(colors), [colors]);

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={[styleAuth.overlayTerminos, { backgroundColor: colors.modalOverlay }]}>
                <View style={[styleAuth.modalContainerTerminos, { backgroundColor: colors.modalBackground }]}>
                    <Text style={[styleAuth.titleTerminos, { color: colors.modalText }]}>{t('termsModal.title')}</Text>

                    <ScrollView persistentScrollbar
                        style={styleAuth.contentTerminos}
                        showsVerticalScrollIndicator
                    >
                        {SECTIONS.map((n) => (
                            <Text key={n} style={[styleAuth.paragraphTerminos, { color: colors.modalTextSecondary }]}>
                                <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>
                                    {t(`termsModal.s${n}Title`)}{"\n\n"}
                                </Text>
                                {t(`termsModal.s${n}Text`)}{"\n"}
                            </Text>
                        ))}
                    </ScrollView>

                    {error ? (
                        <Text accessibilityRole="alert" style={[styleAuth.paragraphTerminos, { color: colors.modalText }]}>{error}</Text>
                    ) : null}
                    {onAccept ? (
                        <TouchableOpacity
                            style={[styleAuth.buttonTerminos, { backgroundColor: colors.modalButton, opacity: busy ? 0.6 : 1 }]}
                            onPress={onAccept}
                            disabled={busy}
                            accessibilityRole="button"
                        >
                            <Text style={[styleAuth.buttonTextTerminos, { color: colors.modalButtonText }]}>
                                {busy ? t('termsGate.signing') : t('termsGate.sign')}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={[styleAuth.buttonTerminos, { backgroundColor: colors.modalButton }]}
                        onPress={onClose}
                        disabled={busy}
                        accessibilityRole="button"
                    >
                        <Text style={[styleAuth.buttonTextTerminos, { color: colors.modalButtonText }]}>
                            {onAccept ? t('termsGate.leave') : t('common.close')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
