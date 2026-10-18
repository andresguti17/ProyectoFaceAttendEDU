// ============================================================
//  FaceAttend EDU — ImportStudentsModal
//
//  Modal para importar estudiantes desde CSV o Excel.
//  El parseo vive en ./importStudentsParser (SheetJS para .xlsx,
//  texto con delimitador detectado para .csv/.tsv — antes solo
//  leía como texto y fallaba con .xlsx y con ";" del Excel en
//  español).
//
//  Columnas esperadas (en cualquier orden, case-insensitive):
//    name | code | email | course | grade | documentNumber | password |
//    attendance | hasFacial | hasFingerprint | status
//
//  Las columnas mínimas requeridas son: name, code y email (code puede
//  completarse con documentNumber). Las filas sin course se matriculan en
//  el par "Curso destino" + "Ficha destino" (cada curso suele tener varias
//  fichas activas); grade no lo consume el backend.
//
//  Las filas cuyo correo o documento ya existen en el sistema se marcan
//  "ya existe" en la vista previa y se omiten al importar (re-importar un
//  archivo ya importado no debe verse como un fallo fila por fila).
// ============================================================

import React, { useState, useEffect } from "react";
import {
    Modal, View, Text, ScrollView, TouchableOpacity,
    ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { AnimatedDropdown, Button, Badge } from "../common";
import { useTheme }       from "../hooks/useTheme";
import { useResponsive }  from "../hooks/useResponsive";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { parseFileContent } from "./importStudentsParser";

// ── Template CSV descargable ──────────────────────────────

const CSV_TEMPLATE =
    "name,code,email,course,grade,attendance,status\n" +
    "Ana García López,AED-401001,a.garcia@uni.edu,AED-401,3er semestre,95,active\n" +
    "Carlos Pérez,AED-401002,c.perez@uni.edu,AED-401,2do semestre,88,active\n" +
    "# Nota: código = códigoCurso + 00 + nnn (ej: AED-401001, AED-401020, etc.)\n";

function downloadTemplate() {
    if (Platform.OS !== "web") return;
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "plantilla_estudiantes.csv";
    a.click();
    URL.revokeObjectURL(url);
}

// ── Selector de archivo (Web only) ───────────────────────

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

// ── Componente principal ──────────────────────────────────

// Identidad estable para la cascada curso → ficha (si se declarara inline
// como default, el useEffect de carga se dispararía en cada render).
const NO_COHORTS = async () => [];

export default function ImportStudentsModal({
    visible, onClose, onImport, courses = [],
    getCohortsForCourse = NO_COHORTS,
    findExistingStudents = null,
}) {
    const { theme }   = useTheme();
    const { isSmall } = useResponsive();
    const { t }       = useTranslation();
    const c           = theme.colors;

    const [step,         setStep]         = useState("idle");
    const [fileName,     setFileName]     = useState(null);
    const [preview,      setPreview]      = useState([]);
    const [parseErrors,  setParseErrors]  = useState(0);
    const [importResult, setImportResult] = useState({ success: 0, errors: [] });
    const [errorMsg,     setErrorMsg]     = useState(null);
    const [targetCourse, setTargetCourse]  = useState("");
    const [targetCohort,  setTargetCohort]  = useState("");
    const [cohortOptions, setCohortOptions] = useState([]);
    const [cohortsLoading, setCohortsLoading] = useState(false);

    // Cascada Curso destino → Ficha destino: provisionStudent exige una sola
    // cohorte y cada curso suele tener varias fichas activas; con una única
    // ficha se preselecciona sola.
    useEffect(() => {
        let alive = true;
        setCohortOptions([]);
        setTargetCohort("");
        if (!targetCourse) {
            setCohortsLoading(false);
            return () => { alive = false; };
        }
        setCohortsLoading(true);
        Promise.resolve(getCohortsForCourse(targetCourse))
            .then((list) => {
                if (!alive) return;
                const opts = (Array.isArray(list) ? list : [])
                    .map((cohort) => ({
                        value: String(cohort?.cohortId ?? ""),
                        label: String(cohort?.code || cohort?.cohortId || ""),
                        icon: "users",
                    }))
                    .filter((opt) => opt.value);
                setCohortOptions(opts);
                if (opts.length === 1) setTargetCohort(opts[0].value);
            })
            .catch(() => {})
            .finally(() => { if (alive) setCohortsLoading(false); });
        return () => { alive = false; };
    }, [targetCourse, getCohortsForCourse]);

    const handleClose = () => {
        setStep("idle");
        setFileName(null);
        setPreview([]);
        setParseErrors(0);
        setImportResult({ success: 0, errors: [] });
        setErrorMsg(null);
        setTargetCourse("");
        onClose();
    };

    const handlePickFile = async () => {
        const result = await pickFile();
        if (!result) return;
        const { rows, errors } = parseFileContent(result.name, result.buffer);
        setFileName(result.name);
        setParseErrors(errors);
        if (rows.length === 0) {
            setErrorMsg(t("El archivo no contiene filas válidas"));
            setStep("error");
            return;
        }
        // Marca filas cuyo correo/documento ya existe en el sistema: se
        // omiten al importar en vez de fallar una por una con "ya existe
        // una persona con ese número de documento". Sin checker (o si
        // falla) el backend sigue siendo la autoridad.
        let marked = rows;
        if (findExistingStudents) {
            try { marked = await findExistingStudents(rows); } catch { marked = rows; }
        }
        setPreview(marked);
        setStep("preview");
        setErrorMsg(null);
    };

    const handleImport = async () => {
        setStep("importing");
        try {
            // Las filas sin course (o con el curso destino) se matriculan en
            // el par Curso+Ficha elegido; las filas con curso propio distinto
            // conservan el suyo y resuelven su cohorte sin ficha asignada.
            // Las filas marcadas "ya existe" no viajan: el backend las
            // rechazaría por unicidad y solo ensuciarían el resultado.
            const drafts = importable.map((r) => {
                const course = r.course || targetCourse;
                const useTarget = course !== "" && course === targetCourse && targetCohort !== "";
                return { ...r, course, cohortId: useTarget ? targetCohort : null };
            });
            // onImport ahora devuelve { success, errors } (alta real en el
            // backend, fila por fila): un fallo individual no detiene el resto.
            const result = await onImport(drafts);
            setImportResult(result ?? { success: 0, errors: [] });
            setStep("done");
        } catch {
            setErrorMsg(t("Error al importar los estudiantes"));
            setStep("error");
        }
    };

    // Si hay filas que usarán el curso destino y aún no está resuelta su
    // ficha (o sigue cargando), el import fallaría en todas con "Select the
    // student cohort": se bloquea el botón con el aviso junto a los selectores.
    const needsTarget = targetCourse !== ""
        && preview.some((r) => !r.course || r.course === targetCourse);
    const missingCohort = needsTarget && (cohortsLoading || targetCohort === "");

    // Filas realmente importables: las marcadas "ya existe" (correo o
    // documento ya en el sistema) se omiten y no cuentan para el botón.
    const importable = preview.filter((r) => !r.existing);
    const existingCount = preview.length - importable.length;

    // Selectores Curso/Ficha destino: se pintan en idle y en preview para
    // poder corregir el destino sin perder el archivo ya cargado.
    const targetSelectors = (
        <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.primary }}>
                {t("Curso destino")}{" "}
                <Text style={{ fontWeight: "400", color: c.text.secondary }}>
                    — {t("para filas sin curso")} ({t("Opcional")})
                </Text>
            </Text>
            <AnimatedDropdown
                items={courses}
                value={targetCourse}
                onSelect={setTargetCourse}
                placeholder={t("Sin curso destino")}
                triggerIcon="book-open"
                searchable
                searchPlaceholder={t("Buscar curso...")}
            />
            {targetCourse !== "" && (
                <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.primary }}>
                        {t("Ficha destino")}{" "}
                        <Text style={{ fontWeight: "400", color: c.text.secondary }}>
                            — {t("se elige sola si solo hay una")}
                        </Text>
                    </Text>
                    {cohortsLoading ? (
                        <ActivityIndicator size="small" color={c.brand.primary} />
                    ) : cohortOptions.length === 0 ? (
                        <Text style={{ fontSize: 12, color: c.status.error }}>
                            {t("El curso no tiene fichas activas")}
                        </Text>
                    ) : (
                        <AnimatedDropdown
                            items={cohortOptions}
                            value={targetCohort}
                            onSelect={setTargetCohort}
                            placeholder={t("Selecciona la ficha destino")}
                            triggerIcon="users"
                            searchable={cohortOptions.length > 6}
                            searchPlaceholder={t("Buscar ficha...")}
                        />
                    )}
                    {!cohortsLoading && cohortOptions.length > 1 && targetCohort === "" && (
                        <Text style={{ fontSize: 12, color: c.status.warning }}>
                            {t("Selecciona la ficha destino")}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );

    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
            <TouchableOpacity
                style={{
                    flex: 1,
                    backgroundColor: c.background.overlay,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: isSmall ? 12 : 24,
                }}
                onPress={handleClose}
                activeOpacity={1}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: c.background.surface,
                        borderRadius: 14,
                        width: isSmall ? "100%" : 580,
                        maxHeight: "92%",
                        overflow: "hidden",
                        shadowColor: "#000",
                        shadowOpacity: 0.18,
                        shadowRadius: 8,
                        elevation: 8,
                    }}
                >
                    {/* Header */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 20,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border.primary,
                    }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={{
                                width: 34,
                                height: 34,
                                borderRadius: 14,
                                backgroundColor: c.brand.primaryLight,
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                                <Feather name="upload" size={18} color={c.brand.primary} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: c.text.primary }}>
                                    {t("Importar estudiantes")}
                                </Text>
                                <Text style={{ fontSize: 11, color: c.text.secondary }}>
                                    {t("Desde archivo CSV o Excel")}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={handleClose}>
                            <Feather name="x" size={20} color={c.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>

                        {/* ── STEP: idle ── */}
                        {step === "idle" && (
                            <View style={{ gap: 16 }}>
                                {/* Zona de arrastre / botón */}
                                <TouchableOpacity
                                    onPress={handlePickFile}
                                    style={{
                                        borderWidth: 2,
                                        borderStyle: "dashed",
                                        borderColor: c.brand.primary,
                                        borderRadius: 14,
                                        padding: 24,
                                        alignItems: "center",
                                        gap: 8,
                                        backgroundColor: c.brand.primaryLight,
                                    }}
                                >
                                    <Feather name="file-text" size={40} color={c.brand.primary} />
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.brand.primary }}>
                                        {t("Seleccionar archivo")}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: c.text.secondary, textAlign: "center" }}>
                                        {t("Formatos soportados: CSV, Excel (.xlsx), TSV")}
                                    </Text>
                                </TouchableOpacity>

                                {/* Curso + Ficha destino: fallback para filas sin course */}
                                {targetSelectors}

                                {/* Plantilla */}
                                <View style={{
                                    backgroundColor: c.background.app,
                                    borderRadius: 14,
                                    padding: 14,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "600", color: c.text.primary }}>
                                            {t("¿Primera vez?")}
                                        </Text>
                                        <Text style={{ fontSize: 13, color: c.text.secondary, marginTop: 2 }}>
                                            {t("Descarga la plantilla con las columnas requeridas")}
                                        </Text>
                                    </View>
                                    <Button variant="ghost" size="sm" onPress={downloadTemplate}>
                                        <Feather name="download" size={14} color={c.text.secondary} />
                                        {"  "}{t("Plantilla CSV")}
                                    </Button>
                                </View>

                                {/* Columnas requeridas */}
                                <View style={{
                                    backgroundColor: c.background.app,
                                    borderRadius: 14,
                                    padding: 14,
                                }}>
                                    <Text style={{
                                        fontSize: 12,
                                        fontWeight: "600",
                                        color: c.text.secondary,
                                        marginBottom: 8,
                                        textTransform: "uppercase",
                                        letterSpacing: 0.5,
                                    }}>
                                        {t("Columnas requeridas")}
                                    </Text>
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                        {["name", "code", "email"].map((col) => (
                                            <Badge key={col} variant="primary">{col}</Badge>
                                        ))}
                                    </View>
                                    <Text style={{
                                        fontSize: 12,
                                        color: c.text.secondary,
                                        marginTop: 8,
                                    }}>
                                        {t("Columnas opcionales")}{": course, grade, documentNumber, password, attendance, hasFacial, hasFingerprint, status"}
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: c.text.secondary,
                                        marginTop: 4,
                                    }}>
                                        {t("Las filas sin course se matriculan en el Curso y Ficha destino; sin code se usa documentNumber")}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* ── STEP: preview ── */}
                        {step === "preview" && (
                            <View style={{ gap: 14 }}>
                                {/* Destino de matrícula (mismos selectores que en idle) */}
                                {targetSelectors}

                                {/* Resumen */}
                                <View style={{
                                    backgroundColor: c.status.successLight,
                                    borderRadius: 14,
                                    padding: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                }}>
                                    <Feather name="file" size={18} color={c.status.success} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "600", color: c.status.success }}>
                                            {fileName}
                                        </Text>
                                        <Text style={{ fontSize: 13, color: c.status.success, marginTop: 2 }}>
                                            {importable.length} {t("estudiantes listos para importar")}
                                            {existingCount > 0 && ` • ${existingCount} ${t("ya existentes (se omitirán)")}`}
                                            {parseErrors > 0 && ` • ${parseErrors} ${t("filas con errores omitidas")}`}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setStep("idle")}>
                                        <Feather name="refresh-cw" size={16} color={c.text.secondary} />
                                    </TouchableOpacity>
                                </View>

                                {parseErrors > 0 && (
                                    <View style={{
                                        backgroundColor: c.status.warningLight,
                                        borderRadius: 14,
                                        padding: 12,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                    }}>
                                        <Feather name="alert-triangle" size={16} color={c.status.warning} />
                                        <Text style={{ fontSize: 13, color: c.status.warning, flex: 1 }}>
                                            {parseErrors} {t("filas con errores omitidas")}
                                            {". "}{t("Verifica que tengan name, code (o documentNumber) y email")}
                                        </Text>
                                    </View>
                                )}

                                {existingCount > 0 && (
                                    <View style={{
                                        backgroundColor: c.status.warningLight,
                                        borderRadius: 14,
                                        padding: 12,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                    }}>
                                        <Feather name="user-check" size={16} color={c.status.warning} />
                                        <Text style={{ fontSize: 13, color: c.status.warning, flex: 1 }}>
                                            {importable.length === 0
                                                ? t("Todos los estudiantes del archivo ya están en el sistema: no hay nada que importar")
                                                : `${existingCount} ${t("estudiantes ya están en el sistema (correo o documento): se omitirán al importar")}`}
                                        </Text>
                                    </View>
                                )}

                                {/* Tabla de vista previa */}
                                <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.secondary }}>
                                    {t("Vista previa")} ({Math.min(5, preview.length)} {t("de")} {preview.length})
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View>
                                        {/* Encabezado */}
                                        <View style={{
                                            flexDirection: "row",
                                            backgroundColor: c.background.app,
                                            paddingVertical: 8,
                                            paddingHorizontal: 10,
                                            borderRadius: 14,
                                        }}>
                                            {["name", "code", "email", "course", "grade", "status"].map((h) => (
                                                <Text key={h} style={{
                                                    width: h === "name" || h === "email" || h === "course" ? 160 : 90,
                                                    fontSize: 12,
                                                    fontWeight: "700",
                                                    color: c.text.secondary,
                                                    textTransform: "uppercase",
                                                    letterSpacing: 0.4,
                                                }}>
                                                    {h}
                                                </Text>
                                            ))}
                                        </View>
                                        {preview.slice(0, 5).map((row, i) => (
                                            <View key={i} style={{
                                                flexDirection: "row",
                                                paddingVertical: 8,
                                                paddingHorizontal: 10,
                                                borderBottomWidth: 1,
                                                borderBottomColor: c.border.primary,
                                                backgroundColor: row.existing ? c.status.warningLight : "transparent",
                                            }}>
                                                {[
                                                    { v: row.name, w: 160 },
                                                    { v: row.code, w: 90 },
                                                    { v: row.email, w: 160 },
                                                    { v: row.course, w: 160 },
                                                    { v: row.grade, w: 90 },
                                                    row.existing
                                                        ? { v: t("ya existe"), w: 90, warn: true }
                                                        : { v: row.status, w: 90 },
                                                ].map(({ v, w, warn }, j) => (
                                                    <Text key={j} style={{
                                                        width: w,
                                                        fontSize: 13,
                                                        color: warn ? c.status.warning : c.text.primary,
                                                    }} numberOfLines={1}>
                                                        {v}
                                                    </Text>
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        )}

                        {/* ── STEP: importing ── */}
                        {step === "importing" && (
                            <View style={{ alignItems: "center", padding: 24, gap: 16 }}>
                                <ActivityIndicator size="large" color={c.brand.primary} />
                                <Text style={{ fontSize: 14, color: c.text.secondary }}>
                                    {t("Importando estudiantes...")}
                                </Text>
                            </View>
                        )}

                        {/* ── STEP: done ── */}
                        {step === "done" && (
                            <View style={{ gap: 14 }}>
                                <View style={{ alignItems: "center", padding: 24, gap: 14 }}>
                                    <View style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: 14,
                                        backgroundColor: importResult.errors.length > 0
                                            ? c.status.errorLight || c.status.error + "20"
                                            : c.status.successLight,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                        <Feather
                                            name={importResult.errors.length > 0 ? "alert-circle" : "check-circle"}
                                            size={32}
                                            color={importResult.errors.length > 0 ? c.status.error : c.status.success}
                                        />
                                    </View>
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: c.text.primary }}>
                                        {importResult.errors.length > 0
                                            ? t("Importación completada con errores")
                                            : t("¡Importación exitosa!")}
                                    </Text>
                                    <Text style={{ fontSize: 14, color: c.text.secondary, textAlign: "center" }}>
                                        {importResult.success} {t("estudiantes agregados al sistema")}
                                    </Text>
                                    {importResult.success > 0 && (
                                        <Text style={{ fontSize: 12, color: c.text.tertiary, textAlign: "center" }}>
                                            {t("Contraseña temporal para todos")}: Estudiante123!
                                        </Text>
                                    )}
                                </View>

                                {importResult.errors.length > 0 && (
                                    <View>
                                        <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.primary, marginBottom: 8 }}>
                                            {t("Estudiantes con errores")}:
                                        </Text>
                                        <View style={{ gap: 8 }}>
                                            {importResult.errors.map((err, i) => (
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
                                                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.text.primary }}>
                                                        {err.student}
                                                    </Text>
                                                    <Text style={{ fontSize: 12, color: c.text.secondary, marginTop: 2 }}>
                                                        {err.reason}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ── STEP: error ── */}
                        {step === "error" && (
                            <View style={{ alignItems: "center", padding: 24, gap: 14 }}>
                                <View style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 14,
                                    backgroundColor: c.status.dangerLight,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    <Feather name="x-circle" size={32} color={c.status.danger} />
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: "600", color: c.text.primary }}>
                                    {t("Error al importar")}
                                </Text>
                                <Text style={{ fontSize: 14, color: c.text.secondary, textAlign: "center" }}>
                                    {errorMsg}
                                </Text>
                                <Button variant="ghost" onPress={() => setStep("idle")}>
                                    {t("Intentar de nuevo")}
                                </Button>
                            </View>
                        )}

                    </ScrollView>

                    {/* Footer */}
                    <View style={{
                        flexDirection: "row",
                        gap: 10,
                        justifyContent: "flex-end",
                        padding: 16,
                        borderTopWidth: 1,
                        borderTopColor: c.border.primary,
                    }}>
                        <Button variant="ghost" onPress={handleClose}>
                            {step === "done" ? t("Cerrar") : t("Cancelar")}
                        </Button>
                        {step === "preview" && (
                            <Button variant="primary" disabled={missingCohort || importable.length === 0} onPress={handleImport}>
                                <Feather name="upload" size={14} color={c.brand.textOnPrimary} />
                                {"  "}{t("Importar")} {importable.length} {t("estudiantes")}
                            </Button>
                        )}
                        {step === "idle" && (
                            <Button variant="primary" onPress={handlePickFile}>
                                <Feather name="folder" size={14} color={c.brand.textOnPrimary} />
                                {"  "}{t("Seleccionar archivo")}
                            </Button>
                        )}
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

