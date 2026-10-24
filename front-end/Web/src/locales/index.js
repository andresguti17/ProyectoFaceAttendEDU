// ============================================================
//  FaceAttend EDU — i18next (ADR-017)
//
//  Recursos estáticos por idioma. El español es el idioma fuente:
//  si una clave no tiene traducción, i18next devuelve la propia clave,
//  así que es.json solo necesita las claves semánticas (no los literales).
// ============================================================

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import es from "./es.json";
import en from "./en.json";
import fr from "./fr.json";
import pt from "./pt.json";

i18n.use(initReactI18next).init({
    resources: {
        es: { translation: es },
        en: { translation: en },
        fr: { translation: fr },
        pt: { translation: pt },
    },
    lng: "es",
    fallbackLng: "es",
    // Las claves heredadas son literales en español con ":" y ".".
    keySeparator: false,
    nsSeparator: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

export default i18n;
