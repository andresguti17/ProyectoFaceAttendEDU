import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../common/ThemeContext';
import { createAuthStyles } from "./style/Style";

export default function RegisterModal({ isVisible, onClose }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styleAuth = useMemo(() => createAuthStyles(colors), [colors]);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styleAuth.overlayRegister, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styleAuth.modalContainerRegister, { backgroundColor: colors.modalBackground }]}>
          <Text style={[styleAuth.titleRegister, { color: colors.modalText }]}>{t('registerModal.title')}</Text>

          <ScrollView
            style={styleAuth.contentRegister}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styleAuth.paragraphRegister, { color: colors.modalTextSecondary }]}>
              {t('registerModal.description')}
            </Text>
          </ScrollView>

          <TouchableOpacity style={[styleAuth.buttonRegister, { backgroundColor: colors.modalButton }]} onPress={onClose}>
            <Text style={[styleAuth.buttonTextRegister, { color: colors.modalButtonText }]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}