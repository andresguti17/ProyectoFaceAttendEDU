// ============================================================
//  Regresión de las pantallas en blanco al abrir un usuario:
//  - StudentDetailModal importaba un ATTENDANCE_THRESHOLDS que ya no
//    existe y reventaba al renderizar la sección de asistencia.
//  - EditUserModal pedía listSchools a referenceData (no lo exporta).
// ============================================================

import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

// El Modal de react-native-web monta un portal que react-test-renderer no soporta.
jest.mock("react-native-web/dist/exports/Modal", () => ({
    __esModule: true,
    default: ({ children }) => children,
}));

jest.mock("../../common", () => {
    const React = require("react");
    const { Text, View } = require("react-native");
    const passthrough = ({ children }) => React.createElement(View, null, children);
    const label = ({ children }) => React.createElement(Text, null, children);
    return {
        Badge: label,
        Avatar: passthrough,
        Button: label,
        ProgressBar: passthrough,
        BaseModal: passthrough,
        TextInput: passthrough,
        AnimatedDropdown: passthrough,
        useAttendanceColor: () => "#000",
    };
});

jest.mock("../../hooks/useTheme", () => ({
    useTheme: () => ({
        theme: {
            colors: new Proxy(
                {},
                { get: () => new Proxy({}, { get: () => "#000" }) }
            ),
        },
    }),
}));
jest.mock("../../hooks/useResponsive", () => ({ useResponsive: () => ({ isSmall: false }) }));
jest.mock("../../../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));
jest.mock("../../../../context/AppDataContext", () => ({
    useAppData: () => ({ courses: [] }),
}));
jest.mock("../../../../core/config/institutionConfig", () => ({
    getInstitutionConfig: () => ({ minAttendance: 75 }),
    onInstitutionConfigChange: () => () => {},
}));
jest.mock("../../../../services/api/biometricCaptureApi", () => ({
    biometricCaptureApi: { summary: jest.fn().mockResolvedValue({ has_face: false, has_fingerprint: false }) },
}));
jest.mock("../BiometricEnrollmentModal", () => () => null);
jest.mock("../../../../services/api/academicApi", () => ({
    academicApi: { listSchools: jest.fn() },
}));

import { academicApi } from "../../../../services/api/academicApi";
import StudentDetailModal from "../StudentDetailModal";
import EditUserModal from "../EditUserModal";

const flatText = (node) =>
    JSON.stringify(node.toJSON()).replace(/\\"/g, '"');

const student = {
    id: "1829",
    name: "Ana García",
    userType: "student",
    attendance: 80,
    status: "active",
    email: "ana@uni.edu",
    schoolId: "2",
};

test("StudentDetailModal renders a student with the configured minimum attendance", () => {
    let tree;
    act(() => {
        tree = create(<StudentDetailModal student={student} onClose={jest.fn()} />);
    });
    const text = flatText(tree);
    expect(text).toContain("Cumple el mínimo requerido");
    expect(text).toContain("(75%)");
});

test("StudentDetailModal flags attendance below the configured minimum", () => {
    let tree;
    act(() => {
        tree = create(
            <StudentDetailModal student={{ ...student, attendance: 40 }} onClose={jest.fn()} />
        );
    });
    expect(flatText(tree)).toContain("Por debajo del mínimo requerido");
});

test("EditUserModal resolves the school name through academicApi", async () => {
    academicApi.listSchools.mockResolvedValue([{ schoolId: 2, name: "Centro" }]);
    let tree;
    await act(async () => {
        tree = create(
            <EditUserModal
                visible
                user={student}
                onClose={jest.fn()}
                onSubmit={jest.fn()}
                canChangeRole={false}
            />
        );
    });
    expect(academicApi.listSchools).toHaveBeenCalled();
    expect(flatText(tree)).toContain("Centro");
});

test("EditUserModal accepts a paginated schools response", async () => {
    academicApi.listSchools.mockResolvedValue({ content: [{ schoolId: 2, name: "Sede Norte" }] });
    let tree;
    await act(async () => {
        tree = create(
            <EditUserModal
                visible
                user={student}
                onClose={jest.fn()}
                onSubmit={jest.fn()}
                canChangeRole={false}
            />
        );
    });
    expect(flatText(tree)).toContain("Sede Norte");
});
