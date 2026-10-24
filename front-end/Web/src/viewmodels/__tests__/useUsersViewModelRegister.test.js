import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAddStudent = jest.fn();
const mockPatchBiometrics = jest.fn();

jest.mock("../../context/AppDataContext", () => ({
    useAppData: () => ({
        students: [],
        teachers: [],
        admins: [],
        courses: [],
        isLoading: false,
        addStudent: mockAddStudent,
        patchBiometrics: mockPatchBiometrics,
        reloadUsers: jest.fn(),
    }),
}));
jest.mock("../../context/AuthContext", () => ({
    useAuth: () => ({ user: { schoolId: 2, personId: "p-self" } }),
}));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));
jest.mock("../../services/api/authApi", () => ({ authApi: {} }));
jest.mock("../../services/api/staffProvisioning", () => ({
    provisionStudent: jest.fn(),
    provisionStaff: jest.fn(),
    credentialsNotice: (form, provisioned) =>
        form.sendCredentials === false ? null : { credentialsEmail: provisioned?.credentialsEmail ?? "FAILED" },
    cohortsForCourseCode: jest.fn(),
    importStudents: jest.fn(),
    personDetails: () => ({}),
    findExistingStudents: jest.fn(),
}));

import { provisionStudent } from "../../services/api/staffProvisioning";
import { useUsersViewModel } from "../useUsersViewModel";

function renderVm() {
    let vm;
    function Probe() {
        vm = useUsersViewModel();
        return null;
    }
    act(() => {
        create(<Probe />);
    });
    return () => vm;
}

const studentForm = {
    name: "Ana García",
    code: "AED-401001",
    email: "ana@uni.edu",
    role: "student",
    documentNumber: "123",
    password: "Secreta123!",
    course: "AED-401",
    status: "active",
    privacyAccepted: true,
    biometricAccepted: true,
};

beforeEach(() => {
    jest.clearAllMocks();
    provisionStudent.mockResolvedValue({ personId: "p-9", credentialsEmail: "SENT" });
});

test("registerUser returns the new personId and which biometrics were requested", async () => {
    const getVm = renderVm();
    let result;
    await act(async () => {
        result = await getVm().registerUser({ ...studentForm, hasFacial: true, hasFingerprint: false });
    });

    expect(result).toEqual({ credentialsEmail: "SENT", personId: "p-9", wantFace: true, wantFingerprint: false });
});

test("the local student row starts without biometrics until they are really captured", async () => {
    const getVm = renderVm();
    await act(async () => {
        await getVm().registerUser({ ...studentForm, hasFacial: true, hasFingerprint: true });
    });

    expect(mockAddStudent).toHaveBeenCalledWith(
        expect.objectContaining({ personId: "p-9", hasFacial: false, hasFingerprint: false })
    );
});

test("markBiometrics forwards the captured flags for that person", () => {
    const getVm = renderVm();
    getVm().markBiometrics("p-9", { hasFacial: true, hasFingerprint: false });
    expect(mockPatchBiometrics).toHaveBeenCalledWith("p-9", { hasFacial: true, hasFingerprint: false });
});

test("registerUser refuses without the privacy notice and forwards the consent otherwise (Ley 1581)", async () => {
    const getVm = renderVm();
    let message;
    await act(async () => {
        message = await getVm().registerUser({ ...studentForm, privacyAccepted: false });
    });
    expect(message).toMatch(/aviso de privacidad/);
    expect(provisionStudent).not.toHaveBeenCalled();

    await act(async () => {
        await getVm().registerUser(studentForm);
    });
    expect(provisionStudent).toHaveBeenCalledWith(
        expect.objectContaining({ consent: { privacyAccepted: true, biometricAccepted: true } })
    );
});
