import {Alert} from "react-native";
import {useEffect, useState} from 'react';
import {validateEmail, validatePhone} from "../utils/validators";
import {CountryService} from "../services/CountryService";
import {SchoolService} from "../services/SchoolService";
import {AcademicConfigService} from "../services/AcademicConfigService";
import AcademicConfiguration from "../models/configuration/AcademicConfiguration";
import School from "../models/academic/School";

const ACADEMIC_FIELD_NAMES = ['academicYear', 'startDate', 'endDate'];
const ATTENDANCE_FIELD_NAMES = ['toleranceMinutes', 'maxAbsences', 'maxLatenesses'];

function buildConfigState(configs, fieldNames, extraDefaults = {}) {
    const byName = {};
    for (const cfg of configs || []) {
        if (cfg?.configurationName) byName[cfg.configurationName] = cfg;
    }
    const state = {...extraDefaults};
    for (const name of fieldNames) {
        state[name] = byName[name]?.configurationValue ?? '';
    }
    return {state, byName};
}


export function useSchoolConfigurationViewModel({isAdmin = false, t = (key) => key} = {}) {
    const [activeTab, setActiveTab] = useState('general');
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const [generalInfo, setGeneralInfo] = useState(null);
    const [contactInfo, setContactInfo] = useState(null);
    const [academicConfig, setAcademicConfig] = useState({
        academicYear: '',
        startDate: '',
        endDate: '',
        totalStudents: 0,
        totalTeachers: 0,
        totalCourses: 0,
    });
    const [attendanceConfig, setAttendanceConfig] = useState({
        toleranceMinutes: '',
        maxAbsences: '',
        maxLatenesses: '',
    });
    const [academicConfigsByName, setAcademicConfigsByName] = useState({});
    const [attendanceConfigsByName, setAttendanceConfigsByName] = useState({});

    const [schoolId, setSchoolId] = useState(null);
    const [originalData, setOriginalData] = useState(null);

    const loadSchoolInfo = async () => {
        try {
            const actorSchoolId = await SchoolService.getCurrentSchoolId();
            if (!actorSchoolId) return;

            const school = await SchoolService.getById(actorSchoolId);

            if (school) {
                const general = {
                    name: school.name,
                    code: school.code,
                    district: '',
                };
                const contact = {
                    email: school.email,
                    phone: school.phone,
                    address: school.address,
                    city: '',
                    country: '',
                };

                let academic = {
                    academicYear: '',
                    startDate: '',
                    endDate: '',
                    totalStudents: 0,
                    totalTeachers: 0,
                    totalCourses: 0,
                };
                let attendance = {
                    toleranceMinutes: '',
                    maxAbsences: '',
                    maxLatenesses: '',
                };
                try {
                    const configs = await AcademicConfigService.getBySchool(actorSchoolId);
                    const academicBuilt = buildConfigState(configs, ACADEMIC_FIELD_NAMES, {
                        totalStudents: 0,
                        totalTeachers: 0,
                        totalCourses: 0,
                    });
                    const attendanceBuilt = buildConfigState(configs, ATTENDANCE_FIELD_NAMES);
                    academic = academicBuilt.state;
                    attendance = attendanceBuilt.state;
                    const mergedByName = {...academicBuilt.byName, ...attendanceBuilt.byName};
                    const academicMap = {};
                    const attendanceMap = {};
                    for (const name of ACADEMIC_FIELD_NAMES) {
                        if (mergedByName[name]) academicMap[name] = mergedByName[name];
                    }
                    for (const name of ATTENDANCE_FIELD_NAMES) {
                        if (mergedByName[name]) attendanceMap[name] = mergedByName[name];
                    }
                    setAcademicConfigsByName(academicMap);
                    setAttendanceConfigsByName(attendanceMap);
                } catch (configError) {
                    console.error('Error cargando configuración académica:', configError);
                }

                setGeneralInfo(general);
                setContactInfo(contact);
                setAcademicConfig(academic);
                setAttendanceConfig(attendance);
                setSchoolId(school.schoolId);
                setOriginalData({general, contact, academic, attendance});
            }
        } catch (error) {
            console.error('Error cargando datos del colegio:', error);
        }
    };

    useEffect(() => {
        loadSchoolInfo();
    }, []);

    const [validationErrors, setValidationErrors] = useState({});

    const validateField = (fieldName, value) => {
        const errors = {...validationErrors};

        if (!value || String(value).trim() === '') {
            errors[fieldName] = t('schoolConfig.validation.required');
        } else if (fieldName === 'email' && !validateEmail(value)) {
            errors[fieldName] = t('schoolConfig.validation.invalidEmail');
        } else if (fieldName === 'phone' && !validatePhone(value)) {
            errors[fieldName] = t('schoolConfig.validation.invalidPhone');
        } else if (
            fieldName === 'toleranceMinutes' ||
            fieldName === 'maxAbsences' ||
            fieldName === 'maxLatenesses' ||
            fieldName === 'minimumGrade'
        ) {
            if (isNaN(value) || Number(value) < 0) {
                errors[fieldName] = t('schoolConfig.validation.mustBeNumber');
            } else {
                delete errors[fieldName];
            }
        } else if (fieldName === 'startDate' || fieldName === 'endDate') {
            const start = fieldName === 'startDate' ? value : academicConfig.startDate;
            const end = fieldName === 'endDate' ? value : academicConfig.endDate;
            if (start && end && new Date(start) >= new Date(end)) {
                errors[fieldName] = t('schoolConfig.validation.invalidDateRange');
            } else {
                delete errors.startDate;
                delete errors.endDate;
            }
        } else {
            delete errors[fieldName];
        }

        setValidationErrors(errors);
        return !errors[fieldName];
    };

    const handleGeneralInfoChange = (field, value) => {
        if (!isAdmin) return;
        setGeneralInfo(prev => ({...prev, [field]: value}));
        setHasChanges(true);
        validateField(field, value);
    };

    const handleContactInfoChange = (field, value) => {
        if (!isAdmin) return;
        setContactInfo(prev => ({...prev, [field]: value}));
        setHasChanges(true);
        validateField(field, value);
    };

    const handleAcademicConfigChange = (field, value) => {
        if (!isAdmin) return;
        setAcademicConfig(prev => ({...prev, [field]: value}));
        setHasChanges(true);
        validateField(field, value);
    };

    const handleAttendanceConfigChange = (field, value) => {
        if (!isAdmin) return;
        setAttendanceConfig(prev => ({...prev, [field]: value}));
        setHasChanges(true);
        validateField(field, value);
    };

    const handleSaveChanges = async () => {
        if (!isAdmin) return;
        if (!schoolId) {
            Alert.alert(t('common.error'), t('schoolConfig.errors.schoolNotFound'));
            return;
        }
        if (Object.keys(validationErrors).length > 0) {
            Alert.alert(t('common.error'), t('schoolConfig.validation.fixErrorsBeforeSaving'));
            return;
        }

        try {
            setIsLoading(true);

            const payload = new School({
                school_id: schoolId,
                name: generalInfo.name,
                code: generalInfo.code,
                email: contactInfo.email,
                phone: contactInfo.phone,
                address: contactInfo.address,
            });

            const updatedSchool = await SchoolService.update(schoolId, payload);

            const persistConfigs = async (fieldNames, values, existingByName, setByName) => {
                const nextByName = {...existingByName};
                for (const name of fieldNames) {
                    const value = values?.[name];
                    if (value === undefined || value === null || String(value).trim() === '') continue;
                    const existing = existingByName[name];
                    if (existing?.configurationId) {
                        const updated = await AcademicConfigService.update(
                            existing.configurationId,
                            new AcademicConfiguration({
                                configuration_id: existing.configurationId,
                                school_id: schoolId,
                                configuration_name: name,
                                configuration_value: String(value),
                                description: existing.description,
                            })
                        );
                        if (updated) nextByName[name] = updated;
                    } else {
                        const created = await AcademicConfigService.create(
                            new AcademicConfiguration({
                                school_id: schoolId,
                                configuration_name: name,
                                configuration_value: String(value),
                            })
                        );
                        if (created) nextByName[name] = created;
                    }
                }
                setByName(nextByName);
            };

            await persistConfigs(ACADEMIC_FIELD_NAMES, academicConfig, academicConfigsByName, setAcademicConfigsByName);
            await persistConfigs(ATTENDANCE_FIELD_NAMES, attendanceConfig, attendanceConfigsByName, setAttendanceConfigsByName);

            if (updatedSchool) {
                const general = {
                    name: updatedSchool.name,
                    code: updatedSchool.code,
                    district: generalInfo.district,
                };
                const contact = {
                    email: updatedSchool.email,
                    phone: updatedSchool.phone,
                    address: updatedSchool.address,
                    city: contactInfo.city,
                    country: contactInfo.country,
                };

                setGeneralInfo(general);
                setContactInfo(contact);
                setOriginalData({general, contact, academic: academicConfig, attendance: attendanceConfig});
            }

            setHasChanges(false);
            setShowConfirmModal(false);
            Alert.alert(t('common.success'), t('schoolConfig.success.updated'));
        } catch (error) {
            console.error('Error guardando configuración del colegio:', error);
            Alert.alert(t('common.error'), t('schoolConfig.errors.saveFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiscardChanges = () => {
        if (!isAdmin) return;
        setHasChanges(false);
        setValidationErrors({});

        if (originalData) {
            setGeneralInfo(originalData.general);
            setContactInfo(originalData.contact);
            setAcademicConfig(originalData.academic);
            setAttendanceConfig(originalData.attendance);
        }
    };

    const [countryModalVisible, setCountryModalVisible] = useState(false);
    const [cityModalVisible, setCityModalVisible] = useState(false);

    const [countryOptions, setCountryOptions] = useState([]);
    const [loadingCountries, setLoadingCountries] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');

    const [citiesOptions, setCitiesOptions] = useState([]);
    const [loadingCities, setLoadingCities] = useState(false);
    const [citySearch, setCitySearch] = useState('');

    useEffect(() => {
        loadAllCountries();
    }, []);

    const filteredCountries = countryOptions.filter((c) =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.dialCode.includes(countrySearch)
    );

    const filteredCities = citiesOptions.filter((city) =>
        city.toLowerCase().includes(citySearch.toLowerCase())
    );

    const CITY_LIMIT = 20;
    const citySearchTrimmed = citySearch.trim();
    const displayedCities = citySearchTrimmed
        ? filteredCities
        : citiesOptions.slice(0, CITY_LIMIT);
    const isCityListLimited = !citySearchTrimmed && citiesOptions.length > CITY_LIMIT;

    const loadAllCountries = async () => {
        setLoadingCountries(true);
        try {
            const countries = await CountryService.fetchAllCountries();
            setCountryOptions(countries);

            const colombia = CountryService.findCountryByName(countries, 'colombia');
            if (colombia) {
                setContactInfo(prev => ({
                    ...prev,
                    country: colombia.name,
                    dialCode: colombia.dialCode,
                }));
                loadCities(colombia.name);
            }
        } catch (error) {
            Alert.alert(t('common.error'), t('schoolConfig.errors.countriesFailed'));
        } finally {
            setLoadingCountries(false);
        }
    };

    const loadCities = async (countryName) => {
        setLoadingCities(true);
        setCitiesOptions([]);
        try {
            const cities = await CountryService.fetchCities(countryName);
            setCitiesOptions(cities);
        } catch (error) {
            Alert.alert(t('common.error'), t('schoolConfig.errors.citiesFailed'));
        } finally {
            setLoadingCities(false);
        }
    };

    const handleCountryChange = (option) => {
        if (!isAdmin) return;
        setContactInfo((prev) => ({
            ...prev,
            country: option.name,
            dialCode: option.dialCode,
            phone: '',
            city: '',
            postalCode: '',
        }));
        setCountrySearch('');
        setHasChanges(true);
        setCountryModalVisible(false);
        loadCities(option.name);
    };

    const handleCityChange = (cityName) => {
        setContactInfo((prev) => ({...prev, city: cityName}));
        setCitySearch('');
        setHasChanges(true);
        setCityModalVisible(false);
    };

    return {
        activeTab, isLoading, showConfirmModal, showAdvanced, hasChanges,
        generalInfo, contactInfo, academicConfig, attendanceConfig,
        validationErrors,
        handleGeneralInfoChange, handleContactInfoChange,
        handleAcademicConfigChange, handleAttendanceConfigChange,
        handleSaveChanges, handleDiscardChanges,
        countryModalVisible, cityModalVisible,
        loadingCountries, loadingCities,
        filteredCountries, displayedCities, isCityListLimited,
        handleCountryChange, handleCityChange,
        countrySearch, setCountrySearch,
        citySearch, setCitySearch,
        CITY_LIMIT, citiesOptions,
        setActiveTab, setCountryModalVisible, setCityModalVisible, setShowConfirmModal,
    };
}
