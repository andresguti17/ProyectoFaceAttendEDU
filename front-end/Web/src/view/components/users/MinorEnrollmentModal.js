// ============================================================
//  FaceAttend EDU — MinorEnrollmentModal
//
//  El administrador de la sede completa el registro de un aprendiz menor de edad con su
//  acudiente presente: datos y vínculo del acudiente, aceptación de los términos y, después,
//  el ingreso de los parámetros faciales (la captura es la del modal biométrico existente).
//  Mientras falte un paso el menor no puede usar funciones con términos ni verificación facial.
// ============================================================

import React, { useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Alert, BaseModal, Button, Checkbox, Select, TextInput } from "../common";
import { useTheme } from "../hooks/useTheme";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { GUARDIAN_DOCUMENT_TYPES, useMinorEnrollmentViewModel } from "../../../viewmodels/useMinorEnrollmentViewModel";
import TermsDocument from "../privacy/TermsDocument";

function StepHeader({ done, label, c }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name={done ? "check-circle" : "circle"} size={18} color={done ? c.status.success : c.text.secondary} />
            <Text style={{ fontWeight: "700", fontSize: 14, color: c.text.primary }}>{label}</Text>
        </View>
    );
}

export default function MinorEnrollmentModal({ visible, student, onClose, onReadyForFace }) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;
    const vm = useMinorEnrollmentViewModel(visible ? student?.personId : null);
    const [present, setPresent] = useState(false);
    const [biometric, setBiometric] = useState(false);
    const [message, setMessage] = useState(null);

    if (!visible || !student?.personId) return null;

    const run = async (action) => {
        setMessage(null);
        const error = await action();
        setMessage(error ? { type: "error", text: t(error) } : { type: "success", text: t("Guardado") });
    };

    const form = vm.form;
    return (
        <BaseModal
            visible
            onClose={onClose}
            title={t("Registro de menor de edad")}
            subtitle={student.name}
            icon="users"
            maxWidth={640}
            footer={
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button variant="ghost" onPress={onClose}>{t("Cerrar")}</Button>
                    <Button variant="primary" disabled={!vm.enabled} onPress={onReadyForFace}>
                        {t("Continuar al registro facial")}
                    </Button>
                </View>
            }
        >
            <View style={{ gap: 16 }}>
                {vm.error ? <Alert type="error" message={vm.error} /> : null}
                {!vm.enabled && !vm.loading && !vm.error ? (
                    <Alert
                        type="warning"
                        message={vm.guardianRegistered
                            ? t("Paso pendiente: registrar la aceptación de los términos del acudiente.")
                            : t("Paso pendiente: registrar al acudiente del aprendiz.")}
                    />
                ) : null}
                {message ? <Alert type={message.type} message={message.text} /> : null}

                <StepHeader done={vm.guardianRegistered} label={t("1. Acudiente")} c={c} />
                <TextInput
                    label={t("Nombre completo del acudiente") + " *"}
                    value={form.fullName}
                    onChangeText={(v) => vm.setField("fullName", v)}
                />
                <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Select
                            label={t("Tipo de documento")}
                            required
                            value={form.documentType}
                            onValueChange={(v) => vm.setField("documentType", v)}
                            options={GUARDIAN_DOCUMENT_TYPES.map((type) => ({ value: type, label: type }))}
                        />
                    </View>
                    <View style={{ flex: 2 }}>
                        <TextInput
                            label={t("Número de documento") + " *"}
                            value={form.documentNumber}
                            onChangeText={(v) => vm.setField("documentNumber", v)}
                        />
                    </View>
                </View>
                <TextInput
                    label={t("Parentesco") + " *"}
                    value={form.relationship}
                    onChangeText={(v) => vm.setField("relationship", v)}
                    placeholder={t("Ej: Madre, padre, tutor legal")}
                />
                <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <TextInput
                            label={t("Correo electrónico")}
                            type="email"
                            value={form.email}
                            onChangeText={(v) => vm.setField("email", v)}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <TextInput
                            label={t("Teléfono")}
                            type="phone"
                            value={form.phone}
                            onChangeText={(v) => vm.setField("phone", v)}
                        />
                    </View>
                </View>
                <Button variant="primary" disabled={vm.saving || vm.loading} onPress={() => run(vm.saveGuardian)}>
                    {vm.guardian ? t("Actualizar acudiente") : t("Registrar y vincular acudiente")}
                </Button>

                <StepHeader done={vm.termsAccepted} label={t("2. Términos y condiciones")} c={c} />
                {vm.guardianRegistered && !vm.termsAccepted ? (
                    <>
                        <TermsDocument />
                        <Checkbox
                            checked={present}
                            onToggle={setPresent}
                            label={t("El acudiente está presente en la sede, leyó los términos y los acepta") + " *"}
                        />
                        <Checkbox
                            checked={biometric}
                            onToggle={setBiometric}
                            label={t("El acudiente autoriza el tratamiento de los datos biométricos del menor (facultativo)")}
                            description={t("Puede dejarse sin marcar: la asistencia del menor se registra por otros medios.")}
                        />
                        <Button
                            variant="primary"
                            disabled={!present || vm.saving}
                            onPress={() => run(() => vm.recordTerms({ biometricAccepted: biometric }))}
                        >
                            {t("Registrar aceptación de los términos")}
                        </Button>
                    </>
                ) : null}
                {vm.termsAccepted ? (
                    <Text style={{ fontSize: 13, color: c.text.secondary }}>
                        {t("Los términos vigentes ya fueron aceptados por el acudiente.")}
                    </Text>
                ) : null}
            </View>
        </BaseModal>
    );
}
