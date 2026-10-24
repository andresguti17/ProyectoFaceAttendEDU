// ============================================================
//  FaceAttend EDU — BiometricEnrollmentModal
//
//  Captura real de rostro (prueba de vida + /facial/enroll-image) y de huella
//  (/fingerprint/enroll-sample) de una persona recién registrada. Reutiliza los
//  módulos de la pantalla Biometría, así que hay un solo flujo biométrico.
//  El registro del usuario ya terminó cuando se abre: cerrarlo sin capturar
//  solo deja la biometría pendiente (se puede completar desde Biometría).
// ============================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, BaseModal, Button } from "../common";
import { FaceModule, FingerprintModule } from "../biometrics";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { useBiometricsViewModel } from "../../../viewmodels/useBiometricsViewModel";
import BiometricConsentPrompt from "../privacy/BiometricConsentPrompt";

const STATUS_ALERT_TYPE = { info: "info", ok: "success", error: "error" };

function EnrollmentBody({ person, wantFace, wantFingerprint, onClose, onFinished }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const vm = useBiometricsViewModel();
    const { setPerson } = vm;

    const sections = [
        ...(wantFace ? [{ id: "face", label: t("Rostro"), icon: "user-check" }] : []),
        ...(wantFingerprint ? [{ id: "fingerprint", label: t("Huella dactilar"), icon: "target" }] : []),
    ];
    const [section, setSection] = useState(sections[0]?.id);

    useEffect(() => {
        setPerson({ personId: person.personId, name: person.name });
        return () => setPerson(null);
    }, [person.personId, person.name, setPerson]);

    const done = { face: !!vm.summary?.has_face, fingerprint: !!vm.summary?.has_fingerprint };
    const finish = () => {
        onFinished?.({ hasFacial: done.face, hasFingerprint: done.fingerprint });
        onClose();
    };

    return (
        <BaseModal
            visible
            onClose={finish}
            title={t("Registro biométrico")}
            subtitle={person.name}
            icon="user-check"
            maxWidth={640}
            footer={
                <Button variant="primary" onPress={finish} disabled={vm.busy}>
                    {done.face || done.fingerprint ? t("Terminar") : t("Omitir por ahora")}
                </Button>
            }
        >
            <View style={{ gap: 14 }}>
                {sections.length > 1 && (
                    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8 }}>
                        {sections.map((item) => {
                            const active = item.id === section;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: active }}
                                    onPress={() => setSection(item.id)}
                                    style={{
                                        flex: 1,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        borderWidth: 1.5,
                                        borderColor: active ? c.brand.primary : c.border.primary,
                                        backgroundColor: active ? c.brand.primaryLight : c.background.app,
                                    }}
                                >
                                    <Feather
                                        name={done[item.id] ? "check-circle" : item.icon}
                                        size={16}
                                        color={done[item.id] ? c.status.success : active ? c.brand.primary : c.text.secondary}
                                    />
                                    <Text
                                        style={{
                                            fontWeight: "600",
                                            fontSize: 13,
                                            color: active ? c.brand.primary : c.text.secondary,
                                        }}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {vm.health === "down" && (
                    <Alert
                        type="warning"
                        message={t("El servicio biométrico no responde. Puedes omitir este paso y completarlo luego desde Biometría.")}
                    />
                )}

                {vm.biometricAuthorized === false && (
                    <BiometricConsentPrompt personName={person.name} onAuthorize={vm.authorizeBiometrics} busy={vm.busy} />
                )}
                {vm.biometricAuthorized === true && section === "face" && <FaceModule vm={vm} mode="register" />}
                {vm.biometricAuthorized === true && section === "fingerprint" && <FingerprintModule vm={vm} enrollOnly />}

                <Alert type={STATUS_ALERT_TYPE[vm.status.tone] || "info"} message={vm.status.text} />
            </View>
        </BaseModal>
    );
}

export default function BiometricEnrollmentModal({ visible, person, ...rest }) {
    if (!visible || !person?.personId || !(rest.wantFace || rest.wantFingerprint)) return null;
    return <EnrollmentBody person={person} {...rest} />;
}
