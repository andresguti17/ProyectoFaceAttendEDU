import React from "react";
import { create, act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../../../../context/ThemeContext";
import { ResponsiveProvider } from "../../../../context/ResponsiveContext";
import { AdminSettings } from "../AdminSettings";
import { StudentSettings } from "../StudentSettings";
import { TeacherSettings } from "../TeacherSettings";
import { SessionTimeInput } from "../sections";

// Icon fonts cannot load under jest; the icon keeps its name/size/color in the tree.
jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.size}:${props.color}` }));

let mockUser = { schoolId: 3, roles: [] };
jest.mock("../../../../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../../../../services/api/settingsPersistence", () => ({
    pushInstitutionConfig: jest.fn(),
    loadBackendOverrides: () => new Promise(() => {}),
    parseSetting: (v) => v,
}));
jest.mock("../../../../services/api/periodSync", () => ({ syncAcademicPeriodFromSettings: jest.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

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

describe("role settings render", () => {
    test.each(["notifications", "security", "appearance"])("StudentSettings %s", (section) => {
        expect(render(<StudentSettings section={section} />).toJSON()).toMatchSnapshot();
    });

    test.each(["notifications", "security", "appearance"])("TeacherSettings %s", (section) => {
        expect(render(<TeacherSettings section={section} />).toJSON()).toMatchSnapshot();
    });

    test.each(["security", "appearance"])("AdminSettings %s", (section) => {
        mockUser = { schoolId: 3, roles: [] };
        expect(render(<AdminSettings section={section} />).toJSON()).toMatchSnapshot();
        mockUser = { schoolId: null, roles: [] };
        expect(render(<AdminSettings section={section} />).toJSON()).toMatchSnapshot();
    });

    test("each screen hands its save and discard actions to the parent", () => {
        for (const Screen of [StudentSettings, TeacherSettings, AdminSettings]) {
            const onSave = jest.fn();
            const onDiscard = jest.fn();
            render(<Screen section="security" onSave={onSave} onDiscard={onDiscard} />);
            expect(onSave).toHaveBeenCalledWith(expect.any(Function));
            expect(onDiscard).toHaveBeenCalledWith(expect.any(Function));
        }
    });

    test("session hints by role for short, normal and long sessions", () => {
        const hints = [StudentSettings, TeacherSettings, AdminSettings].map((Screen) => {
            const hint = render(<Screen section="security" />).root.findByType(SessionTimeInput).props.contextHint;
            return [10, 60, 180].map(hint);
        });
        expect(hints).toMatchSnapshot();
    });
});
