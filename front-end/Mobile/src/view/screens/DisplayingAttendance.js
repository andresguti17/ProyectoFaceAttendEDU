// DisplayingAttendance.js (simplificado)
import React from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {createDisplayingAttendanceStyles} from "./Styles/DisplayingAttendance/Style";
import BottomBar from "../components/common/NavigationBar";
import CustomTabs from "../components/common/CustomTabs";
import {
    approvalTokens,
    formatDateDisplay,
    getSubjectLabel,
    statusTokens,
    useAttendanceViewModel
} from "../../viewmodels/useDisplayingAttendanceViewModel";

// ─────────────────────────────────────────────────────────────────────────────
// FILA DE DETALLE reutilizable en los modales
// ─────────────────────────────────────────────────────────────────────────────

function DetailRow({icon, label, value, colors, valueColor}) {
    const styles = React.useMemo(() => createDisplayingAttendanceStyles(colors), [colors]);
    if (!value || value === "—") return null;
    return (
        <View style={[styles.detailRow, {borderBottomColor: colors.separator}]}>
            <View style={styles.detailRowBody}>
                <Text style={[styles.detailRowLabel, {color: colors.textMuted}]}>{label}</Text>
                <Text style={[styles.detailRowValue, {color: valueColor ?? colors.text}]}>
                    {value}
                </Text>
            </View>
        </View>
    );
}

function SectionLabel({text, colors}) {
    const styles = React.useMemo(() => createDisplayingAttendanceStyles(colors), [colors]);
    return (
        <Text style={[styles.sectionLabel, {color: colors.primary}]}>
            {text}
        </Text>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DETALLE — ADMIN (docente)
// ─────────────────────────────────────────────────────────────────────────────

function TeacherDetailModal({item, visible, onClose, colors, t, isDark}) {
    const styles = React.useMemo(() => createDisplayingAttendanceStyles(colors), [colors]);
    if (!item) return null;
    const cfg = statusTokens(colors, item.estado);
    const initials = item.nombre.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity activeOpacity={1} onPress={onClose}
                              style={styles.modalOverlay}/>
            <View style={[styles.bottomSheet, {
                backgroundColor: colors.background,
                paddingBottom: Platform.OS === "ios" ? 40 : 24,
            }]}>
                {/* Handle */}
                <View style={[styles.sheetHandle, {
                    backgroundColor: colors.separator,
                }]}/>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.sheetScrollContent}
                >
                    {/* Cabecera */}
                    <View style={styles.sheetHeaderRow}>
                        <View style={[styles.avatarLarge, {
                            backgroundColor: cfg.bg,
                            borderColor: cfg.color,
                        }]}>
                            <Text style={[styles.avatarLargeText, {color: cfg.color}]}>
                                {initials}
                            </Text>
                        </View>
                        <View style={styles.headerBody}>
                            <Text style={[styles.headerName, {color: colors.text}]}>
                                {item.nombre}
                            </Text>
                            <Text style={[styles.headerMeta, {color: colors.textSecondary}]}>
                                {getSubjectLabel(item.materia, t)} · {item.codigo_curso}
                            </Text>
                        </View>
                    </View>

                    {/* Asistencia */}
                    <SectionLabel text={t("attendance.sectionAttendance")}
                                  colors={colors}/>
                    <DetailRow label={t("attendance.date")} value={item.fecha}
                               colors={colors}/>
                    <DetailRow label={t("attendance.time")}
                               value={item.hora} colors={colors} valueColor={cfg.color}/>
                    <DetailRow label={t("attendance.day")} value={item.dia}
                               colors={colors}/>
                    <DetailRow label={t("attendance.schedule")}
                               value={`${item.hora_inicio} – ${item.hora_fin}`} colors={colors}/>
                    {/* ERF 7.4: estado de la justificación del retardo o la inasistencia */}
                    {item.estado !== "presente" && (
                        <DetailRow label={t("attendance.approvalStatus")}
                                   value={item.justificacion
                                       ? t(approvalTokens(colors, item.justificacion.estado).label)
                                       : t("attendance.noJustification")}
                                   valueColor={item.justificacion ? approvalTokens(colors, item.justificacion.estado).color : colors.textMuted}
                                   colors={colors}/>
                    )}

                    {/* Materia */}
                    <SectionLabel text={t("attendance.sectionCourse")} colors={colors}/>
                    <DetailRow label={t("attendance.subject")} value={getSubjectLabel(item.materia, t)}
                               colors={colors}/>
                    <DetailRow label={t("attendance.courseCode")}
                               value={item.codigo_curso} colors={colors}/>
                    <DetailRow label={t("attendance.classroom")} value={item.salon}
                               colors={colors}/>

                    {/* Período */}
                    <SectionLabel text={t("attendance.sectionPeriod")}
                                  colors={colors}/>
                    <DetailRow label={t("attendance.period")} value={item.periodo}
                               colors={colors}/>
                    <DetailRow label={t("attendance.periodStart")}
                               value={item.periodo_inicio} colors={colors}/>
                    <DetailRow label={t("attendance.periodEnd")}
                               value={item.periodo_fin} colors={colors}/>
                </ScrollView>

                <TouchableOpacity
                    onPress={onClose}
                    style={[styles.sheetCloseButton, {
                        backgroundColor: colors.categoryBackground,
                    }]}
                >
                    <Text style={[styles.sheetCloseText, {color: colors.textSecondary}]}>
                        {t("common.close")}
                    </Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DETALLE — ESTUDIANTE (registro propio)
// ─────────────────────────────────────────────────────────────────────────────

function StudentDetailModal({item, visible, onClose, colors, t, isDark}) {
    const styles = React.useMemo(() => createDisplayingAttendanceStyles(colors), [colors]);
    if (!item) return null;
    const cfg = statusTokens(colors, item.estado);
    const justCfg = item.justificacion
        ? approvalTokens(colors, item.justificacion.estado)
        : null;

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity activeOpacity={1} onPress={onClose}
                              style={styles.modalOverlay}/>
            <View style={[styles.bottomSheetTall, {
                backgroundColor: colors.background,
                paddingBottom: Platform.OS === "ios" ? 40 : 24,
            }]}>
                {/* Handle */}
                <View style={[styles.sheetHandle, {
                    backgroundColor: colors.separator,
                }]}/>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.sheetScrollContent}
                >
                    {/* Cabecera */}
                    <View style={[styles.statusCard, {
                        backgroundColor: cfg.bg,
                        borderColor: cfg.color + "55",
                    }]}>
                        <View style={styles.statusCardBody}>
                            <Text style={[styles.statusCardTitle, {color: cfg.color}]}>
                                {getSubjectLabel(item.materia, t)}
                            </Text>
                            <Text style={[styles.statusCardCode, {color: cfg.color + "BB"}]}>
                                {item.codigo_curso}
                            </Text>
                        </View>
                    </View>

                    {/* Registro */}
                    <SectionLabel text={t("attendance.sectionAttendance")}
                                  colors={colors}/>
                    <DetailRow label={t("attendance.date")} value={item.fecha}
                               colors={colors}/>
                    <DetailRow label={t("attendance.time")}
                               value={item.hora} colors={colors} valueColor={cfg.color}/>

                    {/* Clase */}
                    <SectionLabel text={t("attendance.sectionClass")}
                                  colors={colors}/>
                    <DetailRow label={t("attendance.teacher")}
                               value={item.docente} colors={colors}/>
                    <DetailRow label={t("attendance.classroom")} value={item.salon}
                               colors={colors}/>
                    <DetailRow label={t("attendance.day")} value={item.dia}
                               colors={colors}/>
                    <DetailRow label={t("attendance.schedule")}
                               value={`${item.hora_inicio} – ${item.hora_fin}`} colors={colors}/>

                    {/* Período */}
                    <SectionLabel text={t("attendance.sectionPeriod")}
                                  colors={colors}/>
                    <DetailRow label={t("attendance.period")} value={item.periodo}
                               colors={colors}/>
                    <DetailRow label={t("attendance.periodStart")}
                               value={item.periodo_inicio} colors={colors}/>
                    <DetailRow label={t("attendance.periodEnd")}
                               value={item.periodo_fin} colors={colors}/>

                    {/* Justificación */}
                    {item.justificacion && (
                        <>
                            <SectionLabel text={t("attendance.sectionJustification")}
                                          colors={colors}/>

                            {/* Badge de aprobación */}
                            <View style={[styles.approvalRow, {borderBottomColor: colors.separator}]}>
                                <View style={styles.approvalBody}>
                                    <Text style={[styles.approvalLabel, {color: colors.textMuted}]}>
                                        {t("attendance.approvalStatus")}
                                    </Text>
                                    <View style={[styles.approvalBadge, {
                                        backgroundColor: justCfg.color + "22",
                                        borderColor: justCfg.color + "55",
                                    }]}>
                                        <Text style={[styles.approvalBadgeText, {color: justCfg.color}]}>
                                            {t(justCfg.label)}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <DetailRow label={t("attendance.justificationText")}
                                       value={item.justificacion.texto} colors={colors}/>
                            <DetailRow label={t("attendance.reviewedAt")}
                                       value={item.justificacion.revisado_en} colors={colors}/>
                        </>
                    )}

                    {/* Sin justificación + ausente → aviso */}
                    {!item.justificacion && item.estado === "ausente" && (
                        <View style={[styles.warnBox, {
                            backgroundColor: colors.statusTarde,
                            borderColor: colors.warning + "55",
                        }]}>
                            <Text style={[styles.warnTitle, {color: colors.warning}]}>
                                {t("attendance.noJustification")}
                            </Text>
                            <Text style={[styles.warnMsg, {color: colors.statusTextTarde}]}>
                                {t("attendance.noJustificationHint")}
                            </Text>
                        </View>
                    )}
                </ScrollView>

                <TouchableOpacity
                    onPress={onClose}
                    style={[styles.sheetCloseButton, {
                        backgroundColor: colors.categoryBackground,
                    }]}
                >
                    <Text style={[styles.sheetCloseTextPlain, {color: colors.textSecondary}]}>
                        {t("common.close")}
                    </Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TARJETA ADMIN
// ─────────────────────────────────────────────────────────────────────────────

function TeacherCard({item, colors, t, isDark, onInfo}) {
    const styles = React.useMemo(() => createDisplayingAttendanceStyles(colors), [colors]);
    const initials = item.nombre.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const cfg = statusTokens(colors, item.estado);

    return (
        <View style={[styles.teacherCard, {
            backgroundColor: colors.card,
            borderColor: colors.separator,
            borderLeftColor: cfg.color,
        }]}>
            <View style={[styles.teacherAvatar, {
                backgroundColor: cfg.bg,
            }]}>
                <Text style={[styles.teacherAvatarText, {color: cfg.color}]}>{initials}</Text>
            </View>

            <View style={styles.teacherBody}>
                <Text style={[styles.teacherName, {color: colors.text}]}>
                    {item.nombre}
                </Text>
                <Text style={[styles.teacherMeta, {color: colors.textSecondary}]}>
                    {getSubjectLabel(item.materia, t)} · <Text
                    style={{color: colors.textMuted}}>{item.codigo_curso}</Text>
                </Text>
                <Text style={[styles.teacherSub, {color: colors.textMuted}]}>
                    {item.fecha} · {item.estado !== "ausente" ? item.hora : "—"}
                </Text>
            </View>

            {/* LUPA CLICKEABLE PARA ABRIR MODAL */}
            <TouchableOpacity
                onPress={() => onInfo(item)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                style={[styles.infoButton, {
                    backgroundColor: cfg.bg,
                }]}
            >
                <Image
                    source={require("../../assets/images/lupa.png")}
                    style={[styles.infoIcon, {tintColor: cfg.color}]}
                />
            </TouchableOpacity>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TARJETA ESTUDIANTE
// ─────────────────────────────────────────────────────────────────────────────

function MyAttendanceCard({item, colors, t, isDark, onInfo}) {
    const styles = React.useMemo(() => createDisplayingAttendanceStyles(colors), [colors]);
    const cfg = statusTokens(colors, item.estado);
    const hasJustification = !!item.justificacion;

    return (
        <View style={[styles.myCard, {
            backgroundColor: colors.card,
            borderColor: colors.separator,
        }]}>
            <View
                style={styles.myCardHeader}>
                <View style={styles.myCardDateRow}>
                    <Text style={[styles.myCardDate, {color: colors.primary}]}>{item.fecha}</Text>
                    {item.estado !== "ausente" && (
                        <Text style={[styles.myCardTime, {color: colors.textSecondary}]}>· {item.hora}</Text>
                    )}
                </View>

                {/* LUPA CLICKEABLE PARA ABRIR MODAL */}
                <TouchableOpacity
                    onPress={() => onInfo(item)}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                    style={[styles.infoButton, {
                        backgroundColor: cfg.bg,
                    }]}
                >
                    <Image
                        source={require("../../assets/images/lupa.png")}
                        style={[styles.infoIcon, {tintColor: cfg.color}]}
                    />
                </TouchableOpacity>
            </View>

            <View style={[styles.myCardBody, {
                borderTopColor: colors.separator,
            }]}>
                <View style={styles.myCardField}>
                    <Text style={[styles.myCardFieldLabel, {color: colors.textMuted}]}>
                        {t("attendance.subject")}
                    </Text>
                    <Text style={[styles.myCardFieldValue, {color: colors.text}]}>{getSubjectLabel(item.materia, t)}</Text>
                </View>
                <View style={styles.myCardField}>
                    <Text style={[styles.myCardFieldLabel, {color: colors.textMuted}]}>
                        {t("attendance.teacher")}
                    </Text>
                    <Text style={[styles.myCardFieldValuePlain, {color: colors.text}]}>{item.docente}</Text>
                </View>
                {hasJustification && (
                    <View style={[styles.justifiedBadge, {
                        backgroundColor: colors.info + "1F",
                    }]}>
                        <Text style={styles.justifiedBadgeText}>
                            {t("attendance.justified")}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

export default function DisplayingAttendance() {
    // Extraemos todas las propiedades UNA SOLA VEZ
    const {
        t,                      // <--- Obtenemos t
        locale,
        isAdmin,
        isStaff,
        isDark,
        colors,
        updateKey,
        searchText,
        setSearchText,
        fromDate,
        setFromDate,
        toDate,
        setToDate,
        setPickedDate,
        statusFilter,
        setStatusFilter,
        showPicker,
        showIOSModal,
        setShowIOSModal,
        tempDate,
        setTempDate,
        activeData,
        detailItem,
        showDetailModal,
        loading,
        error,
        retry,
        openDetail,
        closeDetail,
        handleOpenPicker,
        handleAndroidChange,
    } = useAttendanceViewModel();
    const styles = React.useMemo(() => createDisplayingAttendanceStyles(colors), [colors]);

    return (
        <SafeAreaView
            style={[styles.safeArea, {backgroundColor: colors.background}]}
            key={`${updateKey}`}
        >
            <View style={[styles.mainContainer, {
                backgroundColor: colors.background,
                marginTop: Platform.OS === "ios" ? 15 : 10,
            }]}>
                <View style={styles.tabsWrap}>
                    <CustomTabs userRole={isAdmin ? "admin" : "student"}/>
                </View>

                {/* Filtros */}
                <View style={styles.filtersRow}>
                    {isStaff && (
                        <View style={[styles.searchBox, {
                            backgroundColor: colors.inputBackground,
                            borderColor: searchText ? colors.primary : (colors.separator),
                        }]}>
                            <TextInput
                                style={[styles.searchInput, {color: colors.text}]}
                                placeholder={t("attendance.searchByName")}
                                placeholderTextColor={colors.textMuted}
                                value={searchText}
                                onChangeText={setSearchText}
                            />
                            {searchText ? (
                                <TouchableOpacity onPress={() => setSearchText("")}>
                                    <Text style={[styles.clearText, {color: colors.danger}]}>✕</Text>
                                </TouchableOpacity>
                            ) : (
                                <Image source={require("../../assets/images/lupa.png")}
                                       style={[styles.searchIcon, {tintColor: colors.textMuted}]}/>
                            )}
                        </View>
                    )}
                </View>

                {/* Rango de fechas (inclusivo) */}
                <View style={[styles.filtersRow, {marginTop: 0}]}>
                    {[
                        ["from", fromDate, setFromDate, "attendance.fromDate"],
                        ["to", toDate, setToDate, "attendance.toDate"],
                    ].map(([target, value, setValue, placeholderKey]) => (
                        <TouchableOpacity key={target} onPress={() => handleOpenPicker(target)}
                                          accessibilityRole="button" accessibilityLabel={t(placeholderKey)}
                                          style={[styles.dateButton, {
                                              backgroundColor: colors.inputBackground,
                                              borderColor: value ? colors.primary : (colors.separator),
                                          }]}>
                            <Text style={[styles.dateText, {color: value ? colors.text : colors.textMuted}]}
                                  numberOfLines={1}>
                                {value ? formatDateDisplay(value, t, locale) : t(placeholderKey)}
                            </Text>
                            {value && (
                                <TouchableOpacity onPress={() => setValue(null)}>
                                    <Text style={[styles.clearText, {color: colors.danger}]}>✕</Text>
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Estado */}
                <View style={[styles.filtersRow, {marginTop: 0, flexWrap: "wrap"}]} accessibilityRole="radiogroup">
                    {[["", "attendance.filterAll"], ["presente", "attendance.present"], ["tarde", "attendance.late"], ["ausente", "attendance.absent"]]
                        .map(([value, labelKey]) => {
                            const selected = statusFilter === value;
                            return (
                                <TouchableOpacity key={labelKey} onPress={() => setStatusFilter(value)}
                                                  accessibilityRole="radio" accessibilityState={{selected}}
                                                  style={{
                                                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1,
                                                      borderColor: selected ? colors.primary : colors.separator,
                                                      backgroundColor: selected ? colors.primary : colors.inputBackground,
                                                  }}>
                                    <Text style={{color: selected ? colors.onPrimary : colors.text, fontSize: 13}}>
                                        {t(labelKey)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                </View>

                {/* DateTimePicker Android */}
                {showPicker && Platform.OS === "android" && (
                    <DateTimePicker value={tempDate} mode="date" display="default" onChange={handleAndroidChange}
                                    maximumDate={new Date()}/>
                )}

                {/* DateTimePicker iOS Modal */}
                <Modal transparent visible={showIOSModal} animationType="slide"
                       onRequestClose={() => setShowIOSModal(false)}>
                    <TouchableOpacity activeOpacity={1} onPress={() => setShowIOSModal(false)}
                                      style={styles.modalOverlayLight}/>
                    <View style={[styles.iosSheet, {backgroundColor: colors.card}]}>
                        <View style={[styles.iosHandle, {
                            backgroundColor: colors.separator,
                        }]}/>
                        <View style={styles.iosActionsRow}>
                            <TouchableOpacity onPress={() => setShowIOSModal(false)}>
                                <Text style={[styles.iosActionText, {
                                    color: colors.danger,
                                }]}>{t("common.cancel")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                                setPickedDate(tempDate);
                                setShowIOSModal(false);
                            }}>
                                <Text style={[styles.iosActionText, {
                                    color: colors.primary,
                                }]}>{t("common.accept")}</Text>
                            </TouchableOpacity>
                        </View>
                        <DateTimePicker value={tempDate} mode="date" display="spinner"
                                        onChange={(_, date) => date && setTempDate(date)} maximumDate={new Date()}
                                        style={{backgroundColor: colors.card}} textColor={colors.text}/>
                    </View>
                </Modal>

                {/* Lista */}
                {loading ? (
                    <View style={[styles.emptyWrap, { paddingVertical: 60 }]}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : error ? (
                    <View style={styles.emptyWrap}>
                        <Text style={[styles.emptyText, {color: colors.text}]}>
                            {error}
                        </Text>
                        <TouchableOpacity
                            onPress={retry}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.retry')}
                            style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.onPrimary }}>
                                {t('common.retry')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                <FlatList
                    data={activeData}
                    keyExtractor={item => item.id.toString()}
                    style={styles.listStyle}
                    contentContainerStyle={styles.listContent}
                    renderItem={({item}) =>
                        isStaff
                            ? <TeacherCard item={item} colors={colors} t={t} isDark={isDark} onInfo={openDetail}/>
                            : <MyAttendanceCard item={item} colors={colors} t={t} isDark={isDark} onInfo={openDetail}/>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Text style={[styles.emptyText, {color: colors.textMuted}]}>
                                {t("attendance.noResults")}
                            </Text>
                        </View>
                    }
                    ListFooterComponent={<View style={{paddingBottom: Platform.OS === "ios" ? 50 : 70}}/>}
                />
                )}
            </View>

            <BottomBar/>

            {/* Modales */}
            {isStaff ? (
                <TeacherDetailModal item={detailItem} visible={showDetailModal} onClose={closeDetail} colors={colors}
                                    t={t} isDark={isDark}/>
            ) : (
                <StudentDetailModal item={detailItem} visible={showDetailModal} onClose={closeDetail} colors={colors}
                                    t={t} isDark={isDark}/>
            )}
        </SafeAreaView>
    );
}
