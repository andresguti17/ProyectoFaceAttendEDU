import React from 'react';
import {act, create} from 'react-test-renderer';
import {Switch} from 'react-native';

jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key) => key})}));
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({navigate: jest.fn()})}));
jest.mock('../../components/common/ThemeContext', () => ({
    useTheme: () => ({
        colors: new Proxy({}, {get: (_, name) => (typeof name === 'string' ? `#${name}` : undefined)}),
    }),
}));
const mockToggleAlertType = jest.fn();
jest.mock('../../../utils/AlertsConfigContext', () => ({
    useAlertsConfig: () => ({
        alertsConfig: {enableSuccess: true, enableError: false, enableWarning: true, enableConfirm: false, enableDefault: true, enableIot: false},
        toggleAlertType: mockToggleAlertType,
    }),
}));
jest.mock('../../../viewmodels/useLanguageSettingsViewModel', () => ({
    useLanguageSettingsViewModel: () => ({
        selectedLanguage: 'es',
        setSelectedLanguage: jest.fn(),
        isLoading: false,
        updateKey: 0,
        languages: [{code: 'es', name: 'Español', flag: '🇪🇸'}],
        handleSave: jest.fn(),
        handleBack: jest.fn(),
        alertData: null,
        clearAlert: jest.fn(),
    }),
}));
jest.mock('../../components/common/ScreenSafeArea', () => ({children}) => children);
jest.mock('../../components/common/ScrollView', () => ({children}) => children);
jest.mock('../../components/auth/ReturnButton', () => () => null);
jest.mock('../../components/auth/PrimaryButton', () => () => null);

import LanguageSettingsScreen from '../LanguageSettingsScreen';

test('renders one switch per alert kind, each toggling its own type', () => {
    let tree;
    act(() => {
        tree = create(<LanguageSettingsScreen />);
    });
    const opener = tree.root.find(
        (node) => typeof node.props.onPress === 'function'
            && node.findAll((child) => child.props.children === 'settings.configureAlerts').length > 0,
    );
    act(() => opener.props.onPress());
    const switches = tree.root.findAllByType(Switch);
    expect(switches.map((s) => s.props.value)).toEqual([true, false, true, false, true, false]);
    // Colors follow the alert kind: success, danger (error), warning, primary, primary, danger (IoT).
    expect(switches.map((s) => s.props.thumbColor)).toEqual(['#success', '#textSecondary', '#warning', '#textSecondary', '#primary', '#textSecondary']);
    act(() => switches[5].props.onValueChange());
    expect(mockToggleAlertType).toHaveBeenCalledWith('iot');

    const texts = tree.root.findAll((node) => typeof node.props.children === 'string').map((node) => node.props.children);
    for (const key of ['settings.language', 'settings.appearanceDesc', 'settings.alertsConfiguration', 'settings.iotAlertsDesc']) {
        expect(texts).toContain(key);
    }
});
