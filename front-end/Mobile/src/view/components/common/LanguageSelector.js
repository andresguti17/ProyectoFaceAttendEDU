import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {saveLanguageForRole} from './languageByRole';
import {LanguageService, DEFAULT_LANGUAGES} from '../../../services/LanguageService';
import {useTheme} from './ThemeContext';
import {createCommonStyles} from './style/Style';

const LanguageSelector = ({ isVisible, onClose }) => {
  const { i18n, t } = useTranslation();
  const { colors } = useTheme();
  const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [languages, setLanguages] = useState(DEFAULT_LANGUAGES);

  useEffect(() => {
    let active = true;
    LanguageService.getAll().then((langs) => {
      if (active) setLanguages(langs);
    });
    return () => { active = false; };
  }, []);

  const handleLanguageChange = async (languageCode) => {
    try {
      setSelectedLanguage(languageCode);

      await i18n.changeLanguage(languageCode);

      const role = await AsyncStorage.getItem('userRole');

      if (role) {
        await saveLanguageForRole(role, languageCode);
        console.log(`✅ Idioma guardado desde LanguageSelector: ${role} → ${languageCode}`);
      } else {
        await AsyncStorage.setItem('appLanguage', languageCode);
      }

      onClose();
    } catch (error) {
      console.error('❌ Error cambiando idioma:', error);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={stylescommon.languageOverlay}>
        <View style={stylescommon.languageModal}>
          <Text style={stylescommon.languageTitle}>
            {t('settings.selectLanguage')}
          </Text>

          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                stylescommon.languageOption,
                selectedLanguage === lang.code && stylescommon.languageSelectedOption,
              ]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={stylescommon.languageOptionText}>
                {lang.name}
              </Text>
              {selectedLanguage === lang.code && (
                <Text style={{ marginLeft: 10, color: colors.success }}>✓</Text>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={stylescommon.languageCloseButton}
            onPress={onClose}
          >
            <Text style={stylescommon.languageCloseText}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default LanguageSelector;