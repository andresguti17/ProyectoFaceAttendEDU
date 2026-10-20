import React from "react";
import { create, act } from "react-test-renderer";
import { Text } from "react-native";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("react-native-web/dist/exports/Modal", () => ({
    __esModule: true,
    default: ({ children }) => children,
}));
jest.mock("../../common", () => {
    const React = require("react");
    const { Text, View } = require("react-native");
    const passthrough = ({ children }) => React.createElement(View, null, children);
    return {
        Badge: passthrough,
        Avatar: passthrough,
        ProgressBar: passthrough,
        Button: ({ children, onPress, disabled }) =>
            React.createElement(Text, { onPress: disabled ? undefined : onPress, testID: "button" }, children),
        useAttendanceColor: () => "#000",
    };
});
jest.mock("../../hooks/useTheme", () => ({
    useTheme: () => ({
        theme: { colors: new Proxy({}, { get: () => new Proxy({}, { get: () => "#000" }) }) },
    }),
}));
jest.mock("../../hooks/useResponsive", () => ({ useResponsive: () => ({ isSmall: false }) }));
jest.mock("../../../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));
jest.mock("../../../../context/AppDataContext", () => ({ useAppData: () => ({ courses: [] }) }));
jest.mock("../../../../core/config/institutionConfig", () => ({
    getInstitutionConfig: () => ({ minAttendance: 75 }),
}));
jest.mock("../../../../services/api/biometricCaptureApi", () => ({
    biometricCaptureApi: { summary: jest.fn() },
}));
jest.mock("../BiometricEnrollmentModal", () => {
    const React = require("react");
    const { Text } = require("react-native");
    return (props) =>
        React.createElement(
            Text,
            { testID: "enrollment", onPress: () => props.onFinished({ hasFacial: true, hasFingerprint: false }) },
            `ENROLL:${props.person.personId}:${props.wantFace}:${props.wantFingerprint}`
        );
});

import { biometricCaptureApi } from "../../../../services/api/biometricCaptureApi";
import StudentDetailModal from "../StudentDetailModal";

const student = {
    id: "1829",
    personId: "p-1",
    name: "Ana García",
    userType: "student",
    attendance: 80,
    status: "active",
    email: "ana@uni.edu",
};

async function render(props) {
    let tree;
    await act(async () => {
        tree = create(<StudentDetailModal student={student} onClose={jest.fn()} canRegisterFace {...props} />);
    });
    return tree;
}

const registerButton = (tree) =>
    tree.root.findAll((n) => n.props.testID === "button" && n.props.children === "Registrar")[0];
const text = (tree) => JSON.stringify(tree.toJSON());

beforeEach(() => {
    jest.clearAllMocks();
    biometricCaptureApi.summary.mockResolvedValue({ has_face: false, has_fingerprint: false });
});

test("Registrar opens the real enrollment for that person, both biometrics missing", async () => {
    const tree = await render();
    await act(async () => registerButton(tree).props.onPress());
    expect(text(tree)).toContain("ENROLL:p-1:true:true");
});

test("only what the backend says is missing is requested", async () => {
    biometricCaptureApi.summary.mockResolvedValue({ has_face: true, has_fingerprint: false });
    const tree = await render();
    await act(async () => registerButton(tree).props.onPress());
    expect(text(tree)).toContain("ENROLL:p-1:false:true");
});

test("a person already fully registered gets no Registrar button", async () => {
    biometricCaptureApi.summary.mockResolvedValue({ has_face: true, has_fingerprint: true });
    const tree = await render();
    expect(registerButton(tree)).toBeUndefined();
    expect(text(tree)).toContain("Biometría registrada");
});

test("finishing the enrollment reports the flags and refreshes the summary", async () => {
    const onBiometricsEnrolled = jest.fn();
    const tree = await render({ onBiometricsEnrolled });
    await act(async () => registerButton(tree).props.onPress());
    await act(async () => tree.root.findByProps({ testID: "enrollment" }).props.onPress());
    expect(onBiometricsEnrolled).toHaveBeenCalledWith("p-1", { hasFacial: true, hasFingerprint: false });
});

test("without a person id the button is disabled instead of doing nothing", async () => {
    const tree = await render({ student: { ...student, personId: undefined } });
    await act(async () => registerButton(tree).props.onPress?.());
    expect(tree.root.findAllByType(Text).some((n) => String(n.props.children).startsWith("ENROLL"))).toBe(false);
});
