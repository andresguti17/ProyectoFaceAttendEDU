// ============================================================
//  FaceAttend EDU — Legal SCREEN
//
//  Orquesta las páginas públicas de la política de privacidad y de los términos.
// ============================================================

import React from "react";
import { useNavigation } from "@react-navigation/native";
import LegalView, { LEGAL_DOCS } from "../LegalView";

export function PrivacyScreen() {
    const navigation = useNavigation();
    return <LegalView doc={LEGAL_DOCS.privacy} onBack={() => navigation.navigate("FaceAttendEDU")} />;
}

export function TermsScreen() {
    const navigation = useNavigation();
    return <LegalView doc={LEGAL_DOCS.terms} onBack={() => navigation.navigate("FaceAttendEDU")} />;
}
