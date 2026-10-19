import React, {useMemo, useRef, useState} from 'react';
import {Keyboard, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View,} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import {DocumentSelector} from './DocumentSelector';
import {RHSelector} from './RHSelector';
import {QuestionInput} from './QuestionInput';
import {DatePickerInput} from './DatePickerInput';
import {ProgressBar} from './ProgressBar';
import {createCommonStyles} from './style/Style';
import CustomAlert from './CustomAlert';
import {useCustomAlert} from './useCustomAlert';

export const QuestionnaireModal = ({ visible, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);
    const [step, setStep] = useState(1);
    const [answers, setAnswers] = useState({});
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [selectedRH, setSelectedRH] = useState(null);
    const inputRef = useRef(null);

    const { alertConfig, hideAlert, showWarning } = useCustomAlert();

    const questions = [
        {
            id: 1,
            question: t('questionnaire.documentQuestion'),
            type: 'selector',
            selectorType: 'document',
        },
        {
            id: 2,
            question: t('updatePhoto.documentNumber'),
            placeholder: t('questionnaire.documentPlaceholder'),
            type: 'input',
            keyboardType: 'numeric',
        },
        {
            id: 3,
            question: t('rhSelector.label'),
            type: 'selector',
            selectorType: 'rh',
        },
        {
            id: 4,
            question: t('questionnaire.relativeDocumentQuestion'),
            placeholder: t('questionnaire.documentPlaceholder'),
            type: 'input',
            keyboardType: 'numeric',
        },
        {
            id: 5,
            question: t('questionnaire.birthDateQuestion'),
            placeholder: t('questionnaire.birthDatePlaceholder'),
            hint: t('questionnaire.birthDateHint'),
            type: 'date',
        },
        {
            id: 6,
            question: t('questionnaire.addressQuestion'),
            placeholder: t('questionnaire.addressPlaceholder'),
            hint: t('questionnaire.addressHint'),
            type: 'input',
        },
        {
            id: 7,
            question: t('questionnaire.phoneQuestion'),
            placeholder: t('questionnaire.phonePlaceholder'),
            hint: t('questionnaire.phoneHint'),
            type: 'input',
            keyboardType: 'numeric',
        },
    ];

    const dismissKeyboard = () => {
        Keyboard.dismiss();
        if (inputRef.current) inputRef.current.blur();
    };

    const handleNext = () => {
        dismissKeyboard();

        const currentQuestion = questions[step - 1];

        if (currentQuestion.type === 'selector') {
            if (currentQuestion.selectorType === 'document' && !selectedDocument) {
                showWarning(
                    t('common.requiredField'),
                    t('questionnaire.selectDocument'),
                    [{ text: 'OK', onPress: hideAlert }]
                );
                return;
            }
            if (currentQuestion.selectorType === 'rh' && !selectedRH) {
                showWarning(
                    t('common.requiredField'),
                    t('questionnaire.selectRH'),
                    [{ text: 'OK', onPress: hideAlert }]
                );
                return;
            }
        } else {
            if (!answers[currentQuestion.id]) {
                showWarning(
                    t('common.requiredField'),
                    t('questionnaire.answerRequired'),
                    [{ text: 'OK', onPress: hideAlert }]
                );
                return;
            }
        }

        if (step < questions.length) {
            setStep(step + 1);
        } else {
            // Completar formulario: ejecutar onSuccess con los datos y cerrar
            const formData = {
                documentType: selectedDocument?.label || '',
                documentNumber: answers[2] || '',
                rhType: selectedRH?.label || '',
                relativeDocument: answers[4] || '',
                birthDate: answers[5] || '',
                address: answers[6] || '',
                phone: answers[7] || '',
            };
            onSuccess(formData);
            onClose();
            // Resetear estado
            setStep(1);
            setAnswers({});
            setSelectedDocument(null);
            setSelectedRH(null);
        }
    };

    const handlePrevious = () => {
        dismissKeyboard();
        if (step > 1) setStep(step - 1);
    };

    const handleDocumentSelect = (documento) => {
        setSelectedDocument(documento);
        setAnswers({ ...answers, documento });
    };

    const handleRHSelect = (rh) => {
        setSelectedRH(rh);
        setAnswers({ ...answers, tipoRH: rh });
    };

    const handleAnswer = (text) => {
        setAnswers({ ...answers, [questions[step - 1].id]: text });
    };

    const renderQuestionContent = () => {
        const currentQuestion = questions[step - 1];

        if (currentQuestion.type === 'selector') {
            if (currentQuestion.selectorType === 'document') {
                return (
                    <DocumentSelector
                        selectedDocument={selectedDocument}
                        onSelect={handleDocumentSelect}
                    />
                );
            }
            if (currentQuestion.selectorType === 'rh') {
                return (
                    <RHSelector selectedRH={selectedRH} onSelect={handleRHSelect} />
                );
            }
        }

        // ── Date picker ──
        if (currentQuestion.type === 'date') {
            return (
                <DatePickerInput
                    value={answers[currentQuestion.id] || ''}
                    onChange={handleAnswer}
                    placeholder={currentQuestion.placeholder}
                    hint={currentQuestion.hint}
                />
            );
        }

        // ── Text input (default) ──
        return (
            <QuestionInput
                ref={inputRef}
                placeholder={currentQuestion.placeholder}
                value={answers[currentQuestion.id] || ''}
                onChangeText={handleAnswer}
                keyboardType={currentQuestion.keyboardType}
                hint={currentQuestion.hint}
            />
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
                <View
                    style={[
                        stylescommon.questionnaireModalOverlay,
                        { backgroundColor: colors.modalOverlay },
                    ]}
                >
                    {/* Transparent backdrop — tapping it closes the modal */}
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                    {/* Modal card — touches here do NOT propagate to the backdrop */}
                    <View
                        style={[
                            stylescommon.questionnaireModalContainer,
                            { backgroundColor: colors.modalBackground },
                        ]}
                    >
                        <Text
                            style={[
                                stylescommon.questionnaireModalTitle,
                                { color: colors.modalText },
                            ]}
                        >
                            {t('questionnaire.title')}
                        </Text>
                        <Text
                            style={[
                                stylescommon.questionnaireQuestion,
                                { color: colors.modalTextSecondary },
                            ]}
                        >
                            {t('questionnaire.description')}
                        </Text>

                        <ProgressBar currentStep={step} totalSteps={questions.length} />

                        <Text
                            style={[
                                stylescommon.questionnaireQuestion,
                                { color: colors.modalText },
                            ]}
                        >
                            {questions[step - 1].question?.trim()}
                        </Text>

                        {renderQuestionContent()}

                        <View style={stylescommon.questionnaireButtonsContainer}>
                            {step > 1 && (
                                <TouchableOpacity
                                    style={[
                                        stylescommon.questionnaireButton,
                                        stylescommon.questionnairePreviousButton,
                                        {
                                            backgroundColor: colors.modalButtonSecondary,
                                            borderColor: colors.modalBorder,
                                        },
                                    ]}
                                    onPress={handlePrevious}
                                >
                                    <Text
                                        style={[
                                            stylescommon.questionnairePreviousButtonText,
                                            { color: colors.modalButtonSecondaryText },
                                        ]}
                                    >
                                        {t('common.previous')}
                                    </Text>
                                </TouchableOpacity>
                            )}
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
                                style={[
                                    stylescommon.questionnaireButton,
                                    stylescommon.questionnaireNextButton,
                                    { backgroundColor: colors.modalButton },
                                ]}
                                onPress={handleNext}
                            >
                                <Text
                                    style={[
                                        stylescommon.questionnaireNextButtonText,
                                        { color: colors.modalButtonText },
                                    ]}
                                >
                                    {step === questions.length
                                        ? t('common.send')
                                        : t('common.next')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
