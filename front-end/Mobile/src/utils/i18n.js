import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

const resources = {
  es: { translation: es },
  en: { translation: en },
  fr: { translation: fr },
  pt: { translation: pt },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'es',
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

AsyncStorage.getItem('appLanguage').then(savedLanguage => {
  if (savedLanguage && savedLanguage !== 'es') {
    i18n.changeLanguage(savedLanguage);
  }
}).catch(error => console.log('Error:', error));

export default i18n;