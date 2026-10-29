import {Alert} from 'react-native';
import {useSchoolConfigurationViewModel, configNameOf} from '../useSchoolConfigurationViewModel';
import {SchoolService} from '../../services/SchoolService';
import {AcademicConfigService} from '../../services/AcademicConfigService';
import {CountryService} from '../../services/CountryService';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('../../services/SchoolService', () => ({
    SchoolService: {getCurrentSchoolId: jest.fn(), getById: jest.fn(), update: jest.fn()},
}));
jest.mock('../../services/AcademicConfigService', () => ({
    AcademicConfigService: {getBySchool: jest.fn(), update: jest.fn(), create: jest.fn()},
}));
jest.mock('../../services/CountryService', () => ({
    CountryService: {fetchAllCountries: jest.fn(), fetchCities: jest.fn(), findCountryByName: jest.fn()},
}));

const SCHOOL = {schoolId: 2, name: 'Sede Norte', code: 'N', email: 'norte@sena.edu.co', phone: '3001234567', address: 'Calle 1'};
const t = (k) => k;

function config(id, name, value) {
    return {configurationId: id, configurationName: name, configurationValue: value, description: null};
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    SchoolService.getCurrentSchoolId.mockResolvedValue(2);
    SchoolService.getById.mockResolvedValue(SCHOOL);
    SchoolService.update.mockImplementation(async (_id, school) => ({...SCHOOL, name: school.name}));
    AcademicConfigService.getBySchool.mockResolvedValue([
        config(1, 'tardy_tolerance_minutes', '10'),
        config(2, 'maxAbsences', '3'),
    ]);
    AcademicConfigService.update.mockImplementation(async (id, c) => ({...c, configurationId: id}));
    AcademicConfigService.create.mockImplementation(async (c) => ({...c, configurationId: 99}));
    CountryService.fetchAllCountries.mockResolvedValue([{name: 'Colombia', dialCode: '+57'}, {name: 'Chile', dialCode: '+56'}]);
    CountryService.findCountryByName.mockImplementation((list, name) => list.find((c) => c.name.toLowerCase() === name) || null);
    CountryService.fetchCities.mockResolvedValue(['Bogotá', 'Cali']);
});

async function load(isAdmin = true) {
    const hook = await renderHook(useSchoolConfigurationViewModel, {isAdmin, t});
    await flush();
    return hook.result;
}

test('the tolerance field reads the native tardy_tolerance_minutes key that attendance uses', async () => {
    const vm = await load();

    expect(configNameOf('toleranceMinutes')).toBe('tardy_tolerance_minutes');
    expect(vm().attendanceConfig).toMatchObject({toleranceMinutes: '10', maxAbsences: '3', maxLatenesses: ''});
    expect(vm().generalInfo).toMatchObject({name: 'Sede Norte', code: 'N'});
    expect(vm().contactInfo).toMatchObject({email: 'norte@sena.edu.co', country: 'Colombia'});
});

test('saving updates the existing tolerance row under its native name and creates the missing ones', async () => {
    const vm = await load();
    act(() => vm().handleAttendanceConfigChange('toleranceMinutes', '20'));
    act(() => vm().handleAttendanceConfigChange('maxLatenesses', '5'));

    await act(async () => {
        await vm().handleSaveChanges();
    });

    const updated = AcademicConfigService.update.mock.calls.find(([id]) => id === 1)[1];
    expect(updated).toMatchObject({configurationName: 'tardy_tolerance_minutes', configurationValue: '20', schoolId: 2});
    const created = AcademicConfigService.create.mock.calls.map(([c]) => c.configurationName);
    expect(created).toEqual(['maxLatenesses']);
    expect(created).not.toContain('toleranceMinutes');
    expect(vm().hasChanges).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('common.success', 'schoolConfig.success.updated');
});

test('a validation error blocks saving', async () => {
    const vm = await load();
    act(() => vm().handleContactInfoChange('email', 'no-es-correo'));

    await act(async () => {
        await vm().handleSaveChanges();
    });

    expect(vm().validationErrors.email).toBe('schoolConfig.validation.invalidEmail');
    expect(SchoolService.update).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'schoolConfig.validation.fixErrorsBeforeSaving');
});

test('numbers and date ranges are validated', async () => {
    const vm = await load();

    act(() => vm().handleAttendanceConfigChange('maxAbsences', '-1'));
    expect(vm().validationErrors.maxAbsences).toBe('schoolConfig.validation.mustBeNumber');

    act(() => vm().handleAcademicConfigChange('startDate', '2026-12-01'));
    act(() => vm().handleAcademicConfigChange('endDate', '2026-01-01'));
    expect(vm().validationErrors.endDate).toBe('schoolConfig.validation.invalidDateRange');

    act(() => vm().handleGeneralInfoChange('name', ''));
    expect(vm().validationErrors.name).toBe('schoolConfig.validation.required');
});

test('a failing save is reported and keeps the changes', async () => {
    SchoolService.update.mockRejectedValue(new Error('500'));
    const vm = await load();
    act(() => vm().handleGeneralInfoChange('name', 'Otra'));

    await act(async () => {
        await vm().handleSaveChanges();
    });

    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'schoolConfig.errors.saveFailed');
    expect(vm().hasChanges).toBe(true);
    expect(vm().isLoading).toBe(false);
});

test('discarding restores what was loaded', async () => {
    const vm = await load();
    act(() => vm().handleGeneralInfoChange('name', 'Otra'));

    act(() => vm().handleDiscardChanges());

    expect(vm().generalInfo.name).toBe('Sede Norte');
    expect(vm().hasChanges).toBe(false);
});

test('a non-admin cannot edit or save', async () => {
    const vm = await load(false);

    act(() => vm().handleGeneralInfoChange('name', 'Otra'));
    await act(async () => {
        await vm().handleSaveChanges();
    });

    expect(vm().generalInfo.name).toBe('Sede Norte');
    expect(SchoolService.update).not.toHaveBeenCalled();
});

test('without a school the save explains why', async () => {
    SchoolService.getCurrentSchoolId.mockResolvedValue(null);
    const vm = await load();

    await act(async () => {
        await vm().handleSaveChanges();
    });

    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'schoolConfig.errors.schoolNotFound');
});

test('a configuration failure still shows the school', async () => {
    AcademicConfigService.getBySchool.mockRejectedValue(new Error('403'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const vm = await load();

    expect(vm().generalInfo.name).toBe('Sede Norte');
    expect(vm().attendanceConfig.toleranceMinutes).toBe('');
});

test('country and city pickers filter, limit and reset the dependent fields', async () => {
    CountryService.fetchCities.mockResolvedValue(Array.from({length: 25}, (_, i) => `Ciudad ${i}`));
    const vm = await load();
    expect(vm().isCityListLimited).toBe(true);
    expect(vm().displayedCities).toHaveLength(vm().CITY_LIMIT);

    act(() => vm().setCitySearch('Ciudad 2'));
    expect(vm().displayedCities).toEqual(['Ciudad 2', 'Ciudad 20', 'Ciudad 21', 'Ciudad 22', 'Ciudad 23', 'Ciudad 24']);

    act(() => vm().setCountrySearch('+56'));
    expect(vm().filteredCountries.map((c) => c.name)).toEqual(['Chile']);

    await act(async () => {
        vm().handleCountryChange({name: 'Chile', dialCode: '+56'});
    });
    await flush();
    expect(vm().contactInfo).toMatchObject({country: 'Chile', dialCode: '+56', city: '', phone: ''});
    expect(CountryService.fetchCities).toHaveBeenLastCalledWith('Chile');

    act(() => vm().handleCityChange('Santiago'));
    expect(vm().contactInfo.city).toBe('Santiago');
});

test('a country list failure is reported', async () => {
    CountryService.fetchAllCountries.mockRejectedValue(new Error('offline'));
    await load();

    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'schoolConfig.errors.countriesFailed');
});
