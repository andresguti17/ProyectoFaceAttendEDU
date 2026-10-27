import React from 'react';
import {
    Modal,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';
import styleAuth from "./style/Style";

export default function TerminosModal({ isVisible, onClose }) {
    const { t } = useTranslation();
    const { colors } = useTheme();

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

                    <ScrollView
                        style={styleAuth.contentTerminos}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={[styleAuth.paragraphTerminos, { color: colors.modalTextSecondary }]}>
                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.acceptanceTitle')} {"\n\n"}</Text>
                            {t('termsModal.acceptanceText')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.objectTitle')} {"\n\n"}</Text>
                            {t('termsModal.objectText')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.authorizationTitle')} {"\n\n"}</Text>
                            {t('termsModal.authorizationText')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.sensitiveDataTitle')} {"\n\n"}</Text>
                            {t('termsModal.sensitiveDataText')} {"\n\n"}

                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.purpose1')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.purpose2')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.purpose3')} {"\n\n"}

                            {t('termsModal.sensitiveDataNote')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.finalityTitle')} {"\n\n"}</Text>
                            {t('termsModal.finalityText')} {"\n\n"}

                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.finality1')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.finality2')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.finality3')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.finality4')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.finality5')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.rightsTitle')} {"\n\n"}</Text>
                            {t('termsModal.rightsText')} {"\n\n"}

                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.rights1')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.rights2')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.rights3')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.rights4')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.rights5')} {"\n\n"}

                            {t('termsModal.rightsNote')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.storageTitle')} {"\n\n"}</Text>
                            {t('termsModal.storageText1')} {"\n\n"}
                            {t('termsModal.storageText2')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.transferTitle')} {"\n\n"}</Text>
                            {t('termsModal.transferText')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.responsibilitiesTitle')} {"\n\n"}</Text>
                            {t('termsModal.responsibilitiesText')} {"\n\n"}

                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.responsibilities1')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.responsibilities2')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.responsibilities3')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.responsibilities4')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.liabilityTitle')} {"\n\n"}</Text>
                            {t('termsModal.liabilityText')} {"\n\n"}

                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.liability1')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.liability2')} {"\n\n"}
                            {'\u00A0\u00A0\u00A0\u00A0'}{t('termsModal.liability3')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.modificationsTitle')} {"\n\n"}</Text>
                            {t('termsModal.modificationsText')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.legislationTitle')} {"\n\n"}</Text>
                            {t('termsModal.legislationText')} {"\n\n"}

                            <Text style={[styleAuth.subtitleTerminos, { color: colors.modalText }]}>{t('termsModal.acceptanceFinalTitle')} {"\n\n"}</Text>
                            {t('termsModal.acceptanceFinalText')} {"\n\n"}
                        </Text>
                    </ScrollView>

                    <TouchableOpacity style={[styleAuth.buttonTerminos, { backgroundColor: colors.modalButton }]} onPress={onClose}>
                        <Text style={[styleAuth.buttonTextTerminos, { color: colors.modalButtonText }]}>{t('common.close')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}