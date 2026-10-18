import React, {useEffect, useMemo, useState} from 'react';
import {Text, TouchableOpacity, View,} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import {DocumentTypeService, DEFAULT_DOCUMENT_TYPES} from '../../../services/DocumentTypeService';
import {createCommonStyles} from './style/Style';

export const DocumentSelector = ({ selectedDocument, onSelect }) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);
    const [documentTypes, setDocumentTypes] = useState(DEFAULT_DOCUMENT_TYPES);

    useEffect(() => {
        let active = true;
        DocumentTypeService.getAll().then((docs) => {
            if (active) setDocumentTypes(docs);
        });
        return () => { active = false; };
    }, []);

    return (
        <View style={stylescommon.selectorContainer}>
            <Text style={[stylescommon.selectorLabelSelector, { color: colors.modalText }]}>{t('documentSelector.label')}</Text>
            <View style={stylescommon.optionsContainerSelector}>
                {documentTypes.map((doc) => (
                    <TouchableOpacity
                        key={doc.id}
                        style={[
                            stylescommon.optionSelector,
                            selectedDocument?.id === doc.id && stylescommon.optionSelected,
                            { backgroundColor: selectedDocument?.id === doc.id ? colors.modalOptionSelected : colors.modalInputBackground, borderColor: selectedDocument?.id === doc.id ? colors.modalOptionBorder : colors.modalBorder }
                        ]}
                        onPress={() => onSelect(doc)}
                        activeOpacity={0.7}
                    >
                        <View style={stylescommon.radioContainerSelector}>
                            <View style={[
                                stylescommon.radioOuterSelector,
                                selectedDocument?.id === doc.id && stylescommon.radioOuterSelected,
                                { borderColor: selectedDocument?.id === doc.id ? colors.modalRadioSelected : colors.modalRadioBorder }
                            ]}>
                                {selectedDocument?.id === doc.id && <View style={[stylescommon.radioInnerSelector, { backgroundColor: colors.modalRadioSelected }]} />}
                            </View>
                        </View>
                        <Text style={[
                            stylescommon.optionTextSelector,
                            selectedDocument?.id === doc.id && stylescommon.optionTextSelected,
                            { color: selectedDocument?.id === doc.id ? colors.modalOptionBorder : colors.modalInputText }
                        ]}>
                            {t(doc.labelKey)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};