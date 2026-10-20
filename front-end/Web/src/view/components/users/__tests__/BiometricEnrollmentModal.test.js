import React from "react";
import { create, act } from "react-test-renderer";
import { Text } from "react-native";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("../../common", () => {
    const React = require("react");
    const { Text, View } = require("react-native");
    const passthrough = ({ children }) => React.createElement(View, null, children);
    return {
        Alert: ({ message }) => React.createElement(Text, null, message),
        BaseModal: ({ children, footer }) => React.createElement(View, null, children, footer),
        Button: ({ children, onPress }) => React.createElement(Text, { onPress, testID: "button" }, children),
        Badge: passthrough,
    };
});
jest.mock("../../biometrics", () => {
    const React = require("react");
    const { Text } = require("react-native");
    return {
        FaceModule: ({ mode }) => React.createElement(Text, null, `FACE:${mode}`),
        FingerprintModule: ({ enrollOnly }) => React.createElement(Text, null, `FINGER:${enrollOnly}`),
    };
});
jest.mock("../../hooks/useTheme", () => ({
    useTheme: () => ({
        theme: { colors: new Proxy({}, { get: () => new Proxy({}, { get: () => "#000" }) }) },
    }),
}));
jest.mock("../../../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));

const mockSetPerson = jest.fn();
let mockSummary = null;
jest.mock("../../../../viewmodels/useBiometricsViewModel", () => ({
    useBiometricsViewModel: () => ({
        setPerson: mockSetPerson,
        summary: mockSummary,
        busy: false,
        health: "ok",
        status: { text: "estado", tone: "info" },
    }),
}));

import BiometricEnrollmentModal from "../BiometricEnrollmentModal";

const person = { personId: "p-9", name: "Ana García" };
const text = (tree) => JSON.stringify(tree.toJSON());

function render(props) {
    let tree;
    act(() => {
        tree = create(<BiometricEnrollmentModal visible person={person} onClose={jest.fn()} {...props} />);
    });
    return tree;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockSummary = null;
});

test("renders nothing when hidden, without a person id, or with nothing to capture", () => {
    expect(render({ visible: false, wantFace: true }).toJSON()).toBeNull();
    expect(render({ person: { name: "x" }, wantFace: true }).toJSON()).toBeNull();
    expect(render({ wantFace: false, wantFingerprint: false }).toJSON()).toBeNull();
});

test("selects the new person in the biometrics view model and captures the face for real", () => {
    const tree = render({ wantFace: true, wantFingerprint: false });
    expect(mockSetPerson).toHaveBeenCalledWith({ personId: "p-9", name: "Ana García" });
    expect(text(tree)).toContain("FACE:register");
    expect(text(tree)).not.toContain("FINGER");
});

test("offers the fingerprint enrollment-only flow and tabs when both are requested", () => {
    const tree = render({ wantFace: true, wantFingerprint: true });
    expect(text(tree)).toContain("Rostro");
    expect(text(tree)).toContain("Huella dactilar");
    const fingerTab = tree.root.find(
        (n) =>
            n.props.accessibilityRole === "tab" &&
            typeof n.props.onPress === "function" &&
            n.findAllByType(Text).some((label) => label.props.children === "Huella dactilar")
    );
    act(() => fingerTab.props.onPress());
    expect(text(tree)).toContain("FINGER:true");
});

test("finishing reports what was really captured according to the backend summary", () => {
    mockSummary = { has_face: true, has_fingerprint: false };
    const onFinished = jest.fn();
    const onClose = jest.fn();
    const tree = render({ wantFace: true, wantFingerprint: true, onFinished, onClose });
    const finish = tree.root.findAll((n) => n.props.testID === "button")[0];
    act(() => finish.props.onPress());
    expect(onFinished).toHaveBeenCalledWith({ hasFacial: true, hasFingerprint: false });
    expect(onClose).toHaveBeenCalled();
});

test("skipping with nothing captured reports no biometrics", () => {
    const onFinished = jest.fn();
    const tree = render({ wantFace: true, onFinished });
    expect(text(tree)).toContain("Omitir por ahora");
    act(() => tree.root.findAll((n) => n.props.testID === "button")[0].props.onPress());
    expect(onFinished).toHaveBeenCalledWith({ hasFacial: false, hasFingerprint: false });
});
