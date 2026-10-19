// ============================================================
//  FaceAttend EDU — ImportCoursesModal
//  Modal para importar cursos masivamente desde CSV/Excel.
//  
//  Flujo:
//  1. Usuario selecciona archivo
//  2. Se parsea y muestra preview
//  3. Usuario confirma importación
//  4. Se procesan los registros y se muestran resultados
//
//  El parseo del archivo (SheetJS para .xlsx, delimitador
//  detectado para .csv — antes solo leía como texto con ","
//  fijo, y fallaba con .xlsx y con ";" del Excel en español)
//  vive en components/common/importFileParser.
// ============================================================

import React, { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, BaseModal, Badge } from "../../../components/common";
import { parseFileContent } from "./importCoursesParser";
import { useTheme } from "../../../components/hooks/useTheme";
import { useResponsive } from "../../../components/hooks/useResponsive";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

// ── Estados del flujo de importación ──────────────────────

const IMPORT_STATES = {
    IDLE: "idle",
    PREVIEW: "preview",
    PROCESSING: "processing",
    COMPLETE: "complete",
};

const CSV_TEMPLATE =
    "code,name,program,schedule,room\n" +
    "2240083,Bases de Datos I,ADSI,mañana,B-201\n" +
    "2240084,Redes de Datos,ADSI,tarde,B-202\n";

function downloadTemplate() {
    if (Platform.OS !== "web") return;
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_cursos.csv";
    a.click();
    URL.revokeObjectURL(url);
}

function pickFile() {
    return new Promise((resolve) => {
        if (Platform.OS !== "web") {
            resolve(null);
            return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv,.xlsx,.xls,.tsv,.txt";
        input.onchange = (e) => {
            const file = e.target?.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                resolve({ name: file.name, buffer: evt.target?.result });
            };
            reader.onerror = () => resolve(null);
            // ArrayBuffer para todos: los .xlsx son ZIP binarios y leerlos
            // como texto produce basura que el parser CSV descartaba.
            reader.readAsArrayBuffer(file);
        };
        input.click();
    });
}

// ── Componente principal ─────────────────────────────────

export default function ImportCoursesModal({ visible, onClose, onImport }) {
    const { theme } = useTheme();
    const { isSmall } = useResponsive();
    const { t } = useTranslation();
    const c = theme.colors;

    const [state, setState] = useState(IMPORT_STATES.IDLE);
    const [drafts, setDrafts] = useState([]);
    const [results, setResults] = useState(null);
    const [fileError, setFileError] = useState(null);

    const handleFileSelect = async () => {
        setFileError(null);
        const result = await pickFile();
        if (!result) return;
        const { rows } = parseFileContent(result.name, result.buffer);
        if (rows.length === 0) {
            setFileError(t("El archivo no contiene cursos válidos (columnas: código, nombre, programa)"));
            return;
        }
        setDrafts(rows);
        setState(IMPORT_STATES.PREVIEW);
    };

    const handleImport = async () => {
        setState(IMPORT_STATES.PROCESSING);

        const result = await onImport(drafts);
        
        setResults(result);
        setState(IMPORT_STATES.COMPLETE);
    };

    const handleClose = () => {
        setState(IMPORT_STATES.IDLE);
        setDrafts([]);
        setResults(null);
        setFileError(null);
        onClose();
    };

    const handleRetry = () => {
        setState(IMPORT_STATES.PREVIEW);
        setResults(null);
    };

    if (!visible) return null;

    // ── Renderizado según estado ─────────────────────────────

    // IDLE: Selección de archivo
    if (state === IMPORT_STATES.IDLE) {
        return (
            <BaseModal
                visible={visible}
                onClose={handleClose}
                title={t("Importar cursos")}
                subtitle={t("Carga un archivo CSV o Excel con los datos")}
                icon="upload"
                maxWidth={520}
                footer={
                    <>
                        <Button variant="ghost" onPress={handleClose}>
                            {t("Cancelar")}
                        </Button>
                        <Button variant="primary" onPress={handleFileSelect}>
                            <Feather name="file" size={14} color={c.brand.textOnPrimary} />{" "}
                            {t("Seleccionar archivo")}
                        </Button>
                    </>
                }
            >
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                    <View
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: c.brand.primaryLight || c.brand.primary + "20",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                        }}
                    >
                        <Feather name="upload" size={32} color={c.brand.primary} />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: c.text.primary }}>
                        {t("Importa cursos desde Excel o CSV")}
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: c.text.secondary,
                            textAlign: "center",
                            marginTop: 8,
                        }}
                    >
                        {t(
                            "El archivo debe contener las columnas: código, nombre y programa (opcionales: horario, aula, instructor)"
                        )}
                    </Text>
                    <Button variant="ghost" onPress={downloadTemplate}>
                        <Feather name="download" size={14} color={c.brand.primary} />{" "}
                        {t("Descargar plantilla")}
                    </Button>
                    {fileError && (
                        <Text
                            style={{
                                fontSize: 13,
                                color: c.status.error,
                                textAlign: "center",
                                marginTop: 8,
                            }}
                        >
                            {fileError}
                        </Text>
                    )}
                </View>
            </BaseModal>
        );
    }

    // PREVIEW: Vista previa de cursos a importar
    if (state === IMPORT_STATES.PREVIEW) {
        return (
            <BaseModal
                visible={visible}
                onClose={handleClose}
                title={t("Vista previa")}
                subtitle={`${drafts.length} ${t("cursos listos para importar")}`}
                icon="eye"
                maxWidth={680}
                footer={
                    <>
                        <Button variant="ghost" onPress={handleClose}>
                            {t("Cancelar")}
                        </Button>
                        <Button variant="primary" onPress={handleImport}>
                            {t("Importar")} {drafts.length} {t("cursos")}
                        </Button>
                    </>
                }
            >
                <ScrollView style={{ maxHeight: 400 }}>
                    <View style={{ gap: 10 }}>
                        {drafts.map((draft, i) => (
                            <View
                                key={i}
                                style={{
                                    backgroundColor: c.background.app,
                                    borderRadius: 14,
                                    padding: 14,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 12,
                                }}
                            >
                                <View
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 18,
                                        backgroundColor: c.brand.primaryLight || c.brand.primary + "20",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: "700",
                                            color: c.brand.primary,
                                        }}
                                    >
                                        {i + 1}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "700",
                                            color: c.brand.primary,
                                        }}
                                    >
                                        {draft.code}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: c.text.primary,
                                            marginTop: 2,
                                        }}
                                    >
                                        {draft.name}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: c.text.secondary,
                                            marginTop: 2,
                                        }}
                                    >
                                        {draft.instructor || draft.room
                                            ? `${draft.instructor || "—"} • ${draft.room || "—"}`
                                            : draft.program}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </BaseModal>
        );
    }

    // PROCESSING: Importando
    if (state === IMPORT_STATES.PROCESSING) {
        return (
            <BaseModal
                visible={visible}
                onClose={() => {}}
                title={t("Importando...")}
                subtitle={t("Por favor espera mientras se procesan los cursos")}
                icon="loader"
                maxWidth={480}
                showCloseButton={false}
            >
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                    <ActivityIndicator size="large" color={c.brand.primary} />
                    <Text
                        style={{
                            fontSize: 14,
                            color: c.text.secondary,
                            marginTop: 16,
                        }}
                    >
                        {t("Procesando")} {drafts.length} {t("cursos")}...
                    </Text>
                </View>
            </BaseModal>
        );
    }

    // COMPLETE: Resultado de la importación
    if (state === IMPORT_STATES.COMPLETE && results) {
        const hasErrors = results.errors && results.errors.length > 0;

        return (
            <BaseModal
                visible={visible}
                onClose={handleClose}
                title={t("Importación completada")}
                subtitle={
                    hasErrors
                        ? t("Algunos cursos no pudieron ser importados")
                        : t("Todos los cursos fueron importados exitosamente")
                }
                icon={hasErrors ? "alert-circle" : "check-circle"}
                maxWidth={580}
                footer={
                    <>
                        {hasErrors && (
                            <Button variant="ghost" onPress={handleRetry}>
                                {t("Reintentar")}
                            </Button>
                        )}
                        <Button variant="primary" onPress={handleClose}>
                            {t("Cerrar")}
                        </Button>
                    </>
                }
            >
                <View style={{ gap: 16 }}>
                    {/* Resumen */}
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        <View
                            style={{
                                flex: 1,
                                backgroundColor: c.status.successLight || c.status.success + "20",
                                borderRadius: 14,
                                padding: 14,
                                alignItems: "center",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 24,
                                    fontWeight: "800",
                                    color: c.status.success,
                                }}
                            >
                                {results.success || 0}
                            </Text>
                            <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 4 }}>
                                {t("Importados")}
                            </Text>
                        </View>

                        {hasErrors && (
                            <View
                                style={{
                                    flex: 1,
                                    backgroundColor: c.status.errorLight || c.status.error + "20",
                                    borderRadius: 14,
                                    padding: 14,
                                    alignItems: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 24,
                                        fontWeight: "800",
                                        color: c.status.error,
                                    }}
                                >
                                    {results.errors.length}
                                </Text>
                                <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 4 }}>
                                    {t("Errores")}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Lista de errores */}
                    {hasErrors && (
                        <View>
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: c.text.primary,
                                    marginBottom: 8,
                                }}
                            >
                                {t("Cursos con errores")}:
                            </Text>
                            <ScrollView style={{ maxHeight: 200 }}>
                                <View style={{ gap: 8 }}>
                                    {results.errors.map((err, i) => (
                                        <View
                                            key={i}
                                            style={{
                                                backgroundColor: c.background.app,
                                                borderLeftWidth: 3,
                                                borderLeftColor: c.status.error,
                                                borderRadius: 8,
                                                padding: 10,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: "600",
                                                    color: c.text.primary,
                                                }}
                                            >
                                                {err.course || t("Curso desconocido")}
                                            </Text>
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    color: c.status.error,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {err.reason || t("Error desconocido")}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </View>
            </BaseModal>
        );
    }

    return null;
}
