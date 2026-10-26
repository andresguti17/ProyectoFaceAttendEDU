import React from "react";
import { create, act } from "react-test-renderer";
import { TextInput } from "react-native";
import { ThemeProvider } from "../../../context/ThemeContext";
import { ResponsiveProvider } from "../../../context/ResponsiveContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

const METRICS = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
import UsersFilterBar from "../users/sections/UsersFilterBar";
import CoursesFilterBar from "../courses/sections/CoursesFilterBar";

// Icon fonts cannot load under jest; the icon keeps its name/size/color in the tree.
jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.size}:${props.color}` }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(element) {
    let root;
    act(() => {
        root = create(
            <SafeAreaProvider initialMetrics={METRICS}>
                <ThemeProvider><ResponsiveProvider>{element}</ResponsiveProvider></ThemeProvider>
            </SafeAreaProvider>,
        );
    });
    return root;
}

const vm = (advancedFilter, extra = {}) => ({
    search: "ana",
    setSearch: jest.fn(),
    advancedFilter,
    setAdvancedFilterColumn: jest.fn(),
    setAdvancedFilterValue: jest.fn(),
    setAttendanceFilter: jest.fn(),
    ...extra,
});

// Every branch of the bars: no column, a contextual column and the attendance filter.
const STATES = [
    { column: null, value: null, attendanceFilter: null },
    { column: "status", value: "active", attendanceFilter: null },
    { column: "attendance", value: null, attendanceFilter: { operator: "gte", value: 80 } },
];

describe("filter bars render", () => {
    test.each(STATES.map((s, i) => [i, s]))("UsersFilterBar state %i", (_i, state) => {
        expect(render(<UsersFilterBar vm={vm(state)} />).toJSON()).toMatchSnapshot();
        const withCourses = vm(state, {
            courseOptions: [{ value: "1", label: "ADSI" }],
            courseFilter: "1",
            setCourseFilter: jest.fn(),
        });
        expect(
            render(<UsersFilterBar vm={withCourses} options={{ showCourseFilter: true, searchPlaceholder: "Buscar estudiante..." }} />).toJSON(),
        ).toMatchSnapshot();
    });

    test.each(STATES.map((s, i) => [i, s]))("CoursesFilterBar state %i", (_i, state) => {
        expect(render(<CoursesFilterBar vm={vm(state)} />).toJSON()).toMatchSnapshot();
        expect(
            render(<CoursesFilterBar vm={vm(state)} options={{ filterColumns: [{ key: "name", label: "Nombre", icon: "type" }] }} />).toJSON(),
        ).toMatchSnapshot();
    });

    test("typing in the search box updates the view model", () => {
        const model = vm(STATES[0]);
        const tree = render(<CoursesFilterBar vm={model} />);
        act(() => tree.root.findByType(TextInput).props.onChangeText("redes"));
        expect(model.setSearch).toHaveBeenCalledWith("redes");
    });
});
