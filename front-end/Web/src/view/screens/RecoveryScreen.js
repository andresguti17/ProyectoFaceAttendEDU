// ============================================================
//  FaceAttend EDU — Recovery SCREEN
//
//  Orquesta la recuperación: RecoveryView (UI) + navegación.
// ============================================================

import React from "react";
import { useNavigation } from "@react-navigation/native";
import RecoveryView from "../RecoveryView";

export default function RecoveryScreen() {
    const navigation = useNavigation();

    function onDone() {
        navigation.replace("FaceAttendEDU-Login");
    }

    function onBack() {
        navigation.goBack();
    }

    return <RecoveryView onDone={onDone} onBack={onBack} />;
}
