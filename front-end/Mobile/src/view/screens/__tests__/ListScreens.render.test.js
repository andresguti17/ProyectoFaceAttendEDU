import React from 'react';
import {act, create} from 'react-test-renderer';
import {TouchableOpacity} from 'react-native';

jest.mock('../../components/common/ScreenSafeArea', () => (props) => require('react').createElement('ScreenSafeArea', props));
jest.mock('../../components/auth/ReturnButton', () => (props) => require('react').createElement('ReturnButton', props));

const colors = new Proxy({}, {get: (_, name) => (typeof name === 'string' ? `#${name}` : undefined)});
const t = (key) => key;

let mockCourses = {};
jest.mock('../../../viewmodels/useMyCoursesViewModel', () => ({useMyCoursesViewModel: () => mockCourses}));
let mockSchools = {};
jest.mock('../../../viewmodels/useSchoolsViewModel', () => ({useSchoolsViewModel: () => mockSchools}));

import MyCoursesScreen from '../MyCoursesScreen';
import SchoolsScreen from '../SchoolsScreen';

function render(element) {
    let tree;
    act(() => {
        tree = create(element);
    });
    return tree;
}

const FICHAS = [
    {
        cohortId: 1, cohortCode: '2758', programName: 'ADSI', enrolledOn: '2026-02-01T00:00:00Z', studentsCount: 28,
        courses: [{courseId: 10, name: 'Bases de datos', code: 'BD1'}, {name: '', code: 'X2'}],
    },
    {cohortCode: '2760', programName: 'Redes', courses: []},
];

const SCHOOLS = [
    {schoolId: 1, name: 'Sede Norte', code: 'N01', address: 'Calle 1', phone: '555', status: true, programsCount: 4},
    {schoolId: 2, name: 'Sede Sur', code: 'S02', status: false, programsCount: 0},
];

const STATES = {
    loading: {loading: true, error: null},
    error: {loading: false, error: 'Sin conexión'},
    empty: {loading: false, error: null},
    data: {loading: false, error: null},
};

describe.each(Object.keys(STATES))('list screens: %s', (state) => {
    test.each(['teacher', 'student'])('MyCoursesScreen as %s', (role) => {
        mockCourses = {...STATES[state], role, fichas: state === 'data' ? FICHAS : [], reload: jest.fn(), colors, t};
        expect(render(<MyCoursesScreen navigation={{navigate: jest.fn()}} />).toJSON()).toMatchSnapshot();
    });

    test('SchoolsScreen', () => {
        mockSchools = {...STATES[state], schools: state === 'data' ? SCHOOLS : [], reload: jest.fn(), colors, t};
        expect(render(<SchoolsScreen navigation={{navigate: jest.fn()}} />).toJSON()).toMatchSnapshot();
    });
});

test('retry reloads and the back button returns to the dashboard', () => {
    const navigation = {navigate: jest.fn()};
    mockSchools = {...STATES.error, schools: [], reload: jest.fn(), colors, t};
    const tree = render(<SchoolsScreen navigation={navigation} />);
    act(() => tree.root.findByType(TouchableOpacity).props.onPress());
    act(() => tree.root.findByType('ReturnButton').props.onPress());
    expect(mockSchools.reload).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('DashboardScreen');
});
