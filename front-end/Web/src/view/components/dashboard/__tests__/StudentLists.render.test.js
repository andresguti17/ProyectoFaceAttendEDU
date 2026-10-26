import React from "react";
import { create, act } from "react-test-renderer";
import { TouchableOpacity } from "react-native";
import { ThemeProvider } from "../../../../context/ThemeContext";
import { AtRiskStudentsList } from "../AtRiskStudentsList";
import { PerfectAttendanceList } from "../PerfectAttendanceList";

// Icon fonts cannot load under jest; the icon keeps its name/size/color in the tree.
jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.size}:${props.color}` }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(element) {
    let root;
    act(() => {
        root = create(<ThemeProvider>{element}</ThemeProvider>);
    });
    return root;
}

const student = (id, extra) => ({
    id,
    name: `Estudiante ${id}`,
    code: `C-${id}`,
    fichaName: "ADSI 2758",
    lastAttendance: "hace 2 días",
    totalAbsences: 4,
    consecutiveAbsences: 0,
    daysUntilSanction: 12,
    streak: "10 días",
    ...extra,
});

// Default config: min 80%, danger/warning 70%, 15 days to sanction (critical at 8).
const AT_RISK = [
    student(1, { attendanceRate: 75 }),
    student(2, { attendanceRate: 50, consecutiveAbsences: 3 }),
    student(3, { attendanceRate: 78, daysUntilSanction: 2 }),
];

const PERFECT = [
    student(4, { attendanceRate: 100 }),
    student(5, { attendanceRate: 90 }),
    student(6, { attendanceRate: 60 }),
];

describe("dashboard student lists render", () => {
    test("at-risk list: sorted rows, highlight on the first high-risk row", () => {
        expect(render(<AtRiskStudentsList students={AT_RISK} />).toJSON()).toMatchSnapshot();
    });

    test("at-risk list: overflow footer and empty state", () => {
        expect(render(<AtRiskStudentsList students={AT_RISK} maxItems={1} />).toJSON()).toMatchSnapshot();
        expect(render(<AtRiskStudentsList students={[]} />).toJSON()).toMatchSnapshot();
    });

    test("perfect list: perfect, excellent and low rows", () => {
        expect(render(<PerfectAttendanceList students={PERFECT} />).toJSON()).toMatchSnapshot();
    });

    test("perfect list: overflow footer and empty state", () => {
        expect(render(<PerfectAttendanceList students={PERFECT} maxItems={2} />).toJSON()).toMatchSnapshot();
        expect(render(<PerfectAttendanceList students={[]} />).toJSON()).toMatchSnapshot();
    });

    test("rows report the pressed student; the footer opens the filtered users list", () => {
        const onStudentPress = jest.fn();
        const navigation = { navigate: jest.fn() };
        const tree = render(
            <AtRiskStudentsList students={AT_RISK} maxItems={2} onStudentPress={onStudentPress} navigation={navigation} />,
        );
        const buttons = tree.root.findAllByType(TouchableOpacity);
        act(() => buttons[0].props.onPress());
        act(() => buttons[buttons.length - 1].props.onPress());
        expect(onStudentPress).toHaveBeenCalledWith(AT_RISK[1]);
        expect(navigation.navigate).toHaveBeenCalledWith("Users", { section: "students", attendanceFilter: "lt" });

        const perfect = render(<PerfectAttendanceList students={PERFECT} maxItems={1} navigation={navigation} />);
        const perfectButtons = perfect.root.findAllByType(TouchableOpacity);
        act(() => perfectButtons[perfectButtons.length - 1].props.onPress());
        expect(navigation.navigate).toHaveBeenLastCalledWith("Users", { section: "students", attendanceFilter: "gt" });
    });
});
