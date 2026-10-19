import React, {useMemo, useState} from 'react';
import {Modal, Text, TouchableOpacity, TouchableWithoutFeedback, View,} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import {createCommonStyles} from './style/Style';
import CustomAlert from './CustomAlert';
import {useCustomAlert} from './useCustomAlert';

const facialChanges = [
    {id: "beard", label: "facialUpdate.beardChange"},
    {id: "hair", label: "facialUpdate.hairChange"},
    {id: "glasses", label: "facialUpdate.glasses"},
    {id: "weight", label: "facialUpdate.weightChange"},
    {id: "makeup", label: "facialUpdate.makeup"},
    {id: "expression", label: "facialUpdate.expression"}
];

export const FacialUpdateModal = ({visible, onClose, onSuccess}) => {
    const {t} = useTranslation();
    const {colors} = useTheme();
    const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);
    const [selectedChange, setSelectedChange] = useState(null);

    // Hook de alerta personalizada
    const {
        alertConfig,
        hideAlert,
        showWarning,
        showConfirm,
    } = useCustomAlert();

    const handleUpdate = () => {
        if (!selectedChange) {
            showWarning(
                t('facialUpdate.selectOption'),
                t('facialUpdate.selectOptionMessage'),
                [{text: 'OK', onPress: hideAlert}]
            );
            return;
        }

        showConfirm(
            t('facialUpdate.updateParams'),
            t('facialUpdate.confirmUpdate'),
            () => {
                // Confirmado: encontrar el cambio seleccionado y pasar los datos
                const selectedItem = facialChanges.find(change => change.id === selectedChange);
                const facialData = {
                    changeId: selectedChange,
                    changeLabel: selectedItem ? t(selectedItem.label) : selectedChange,
                };
                onSuccess(facialData);
                onClose();
                setSelectedChange(null);
            },
            () => {
                // Cancelado
                console.log('Actualización facial cancelada');
            }
        );
    };

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                transparent={true}
                onRequestClose={onClose}
            >
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={[stylescommon.facialModalOverlay, {backgroundColor: colors.modalOverlay}]}>
                        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                            <View
                                style={[stylescommon.facialModalContainer, {backgroundColor: colors.modalBackground}]}>
                                <Text style={[stylescommon.facialModalTitle, {color: colors.modalText}]}>
                                    {t('facialUpdate.updateParams')}
                                </Text>
                                <Text style={[stylescommon.facialModalSubtitle, {color: colors.modalTextSecondary}]}>
                                    {t('facialFail.updateParamsDescription')}
                                </Text>

                                <Text style={[stylescommon.facialSelectLabel, {color: colors.modalText}]}>
                                    {t('facialUpdate.selectOption')}:
                                </Text>

                                {facialChanges.map((change) => (
                                    <TouchableOpacity
                                        key={change.id}
                                        style={[
                                            stylescommon.facialChangeOption,
                                            selectedChange === change.id && stylescommon.facialChangeOptionSelected,
                                            {
                                                backgroundColor: selectedChange === change.id ? colors.modalOptionSelected : colors.modalBackground,
                                                borderColor: selectedChange === change.id ? colors.modalOptionBorder : colors.modalBorder
                                            }
                                        ]}
                                        onPress={() => setSelectedChange(change.id)}
                                    >
                                        <View
                                            style={[stylescommon.facialRadioCircle, {borderColor: selectedChange === change.id ? colors.modalRadioSelected : colors.modalRadioBorder}]}>
                                            {selectedChange === change.id && <View
                                                style={[stylescommon.facialRadioSelected, {backgroundColor: colors.modalRadioSelected}]}/>}
                                        </View>
                                        <Text style={[stylescommon.facialChangeLabel, {color: colors.modalText}]}>
                                            {t(change.label)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}

                                <View style={stylescommon.facialModalButtons}>
                                    <TouchableOpacity
                                        style={[stylescommon.facialModalButton, stylescommon.facialCancelModalButton, {
                                            backgroundColor: colors.modalButtonSecondary,
                                            borderColor: colors.modalBorder
                                        }]}
                                        onPress={onClose}
                                    >
                                        <Text
                                            style={[stylescommon.facialCancelModalButtonText, {color: colors.modalButtonSecondaryText}]}>
                                            {t('common.cancel')}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[stylescommon.facialModalButton, stylescommon.facialConfirmModalButton, {backgroundColor: colors.modalButton}]}
                                        onPress={handleUpdate}
                                    >
                                        <Text
                                            style={[stylescommon.facialConfirmModalButtonText, {color: colors.modalButtonText}]}>
                                            {t('facialUpdate.updateParams')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Alerta personalizada fuera del modal de actualización facial */}
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                type={alertConfig.type}
                onClose={hideAlert}
            />
        </>
    );
};
