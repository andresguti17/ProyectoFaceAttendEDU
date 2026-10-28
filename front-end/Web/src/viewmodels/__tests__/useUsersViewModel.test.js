import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockPatchStaff = jest.fn();
const mockAddStudent = jest.fn();
const mockReloadStudents = jest.fn();
const mockBulkImport = jest.fn();

jest.mock("../../context/AppDataContext", () => ({
    useAppData: () => ({
        students: [],
        teachers: [],
        admins: [],
        courses: [],
        isLoading: false,
        addStudent: mockAddStudent,
        importStudents: jest.fn(),
        reloadStudents: mockReloadStudents,
        addUser: jest.fn(),
        patchStaff: mockPatchStaff,
    }),
}));

jest.mock("../../services/api/staffProvisioning", () => ({
    ...jest.requireActual("../../services/api/staffProvisioning"),
    importStudents: (...args) => mockBulkImport(...args),
}));

jest.mock("../../context/AuthContext", () => ({
    useAuth: () => ({ user: { schoolId: 2, personId: "p-self" } }),
}));

jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));

jest.mock("../../services/api/authApi", () => ({
    authApi: {
        updatePerson: jest.fn(),
        updateUser: jest.fn(),
        setUserStatus: jest.fn(),
        setPersonStatus: jest.fn(),
    },
}));

import { authApi } from "../../services/api/authApi";
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

const target = { id: "u-1", personId: "p-1", userType: "admin", status: "active" };
const form = {
    name: "Ana",
    lastName: "García",
    documentNumber: "123",
    email: "Ana@uni.edu",
    phone: "",
    username: "ana.garcia",
    status: "active",
};

beforeEach(() => {
    jest.clearAllMocks();
    authApi.updatePerson.mockResolvedValue({});
    authApi.updateUser.mockResolvedValue({});
    authApi.setUserStatus.mockResolvedValue({});
    authApi.setPersonStatus.mockResolvedValue({});
});

test("updates person and user, then mirrors locally", async () => {
    const getVm = renderVm();
    let err;
    await act(async () => {
        err = await getVm().updateUserDetails(target, form);
    });

    expect(err).toBeNull();
    expect(authApi.updatePerson).toHaveBeenCalledWith("p-1", {
        documentNumber: "123",
        name: "Ana",
        lastName: "García",
        email: "ana@uni.edu",
        phone: null,
    });
    expect(authApi.updateUser).toHaveBeenCalledWith("u-1", { username: "ana.garcia" });
    expect(authApi.setUserStatus).not.toHaveBeenCalled();
    expect(mockPatchStaff).toHaveBeenCalledWith("admin", "u-1", {
        name: "Ana García",
        email: "ana@uni.edu",
        username: "ana.garcia",
        status: "active",
    });
});

test("toggles status on both records when it changes", async () => {
    const getVm = renderVm();
    await act(async () => {
        await getVm().updateUserDetails(target, { ...form, status: "inactive" });
    });

    expect(authApi.setUserStatus).toHaveBeenCalledWith("u-1", false);
    expect(authApi.setPersonStatus).toHaveBeenCalledWith("p-1", false);
    expect(mockPatchStaff).toHaveBeenCalledWith(
        "admin",
        "u-1",
        expect.objectContaining({ status: "inactive" })
    );
});

test("rejects without backend link and surfaces backend errors", async () => {
    const getVm = renderVm();
    let err;
    await act(async () => {
        err = await getVm().updateUserDetails({ id: null }, form);
    });
    expect(err).toBeTruthy();

    authApi.updatePerson.mockRejectedValueOnce(new Error("duplicate"));
    await act(async () => {
        err = await getVm().updateUserDetails(target, form);
    });
    expect(err).toBe("duplicate");
    expect(mockPatchStaff).not.toHaveBeenCalled();
});

describe("bulkUpdateUsers", () => {
    const users = [
        { id: "u-1", personId: "p-1", name: "Ana", userType: "admin", status: "active" },
        { id: "u-2", personId: "p-2", name: "Beto", userType: "admin", status: "active" },
    ];

    test("applies the status change to every selected user", async () => {
        const getVm = renderVm();
        let result;
        await act(async () => {
            result = await getVm().bulkUpdateUsers(users, "deactivate");
        });

        expect(result).toEqual({ done: 2, failures: [] });
        expect(authApi.setUserStatus).toHaveBeenCalledWith("u-1", false);
        expect(authApi.setUserStatus).toHaveBeenCalledWith("u-2", false);
        expect(authApi.setPersonStatus).toHaveBeenCalledWith("p-1", false);
        expect(authApi.setPersonStatus).toHaveBeenCalledWith("p-2", false);
    });

    test("activate sends status=true and delete is a soft deactivation", async () => {
        const getVm = renderVm();
        await act(async () => {
            await getVm().bulkUpdateUsers([users[0]], "activate");
        });
        expect(authApi.setUserStatus).toHaveBeenLastCalledWith("u-1", true);

        await act(async () => {
            await getVm().bulkUpdateUsers([users[0]], "delete");
        });
        expect(authApi.setUserStatus).toHaveBeenLastCalledWith("u-1", false);
    });

    test("keeps going after a failure and reports it by user", async () => {
        authApi.setUserStatus.mockRejectedValueOnce(new Error("forbidden"));
        const getVm = renderVm();
        let result;
        await act(async () => {
            result = await getVm().bulkUpdateUsers(users, "deactivate");
        });

        expect(result.done).toBe(1);
        expect(result.failures).toEqual([{ id: "u-1", name: "Ana", reason: "forbidden" }]);
        expect(authApi.setUserStatus).toHaveBeenCalledTimes(2);
    });

    test("never applies the action to the caller's own account", async () => {
        const getVm = renderVm();
        const self = { id: "u-9", personId: "p-self", name: "Yo", userType: "admin", status: "active" };
        let result;
        await act(async () => {
            result = await getVm().bulkUpdateUsers([self, users[1]], "deactivate");
        });

        expect(result.done).toBe(1);
        expect(result.failures).toEqual([
            { id: "u-9", name: "Yo", reason: "No puedes aplicar esta acción a tu propia cuenta" },
        ]);
        expect(authApi.setUserStatus).toHaveBeenCalledTimes(1);
        expect(authApi.setUserStatus).toHaveBeenCalledWith("u-2", false);
    });
});

describe("importUsers — la lista se actualiza sin recargar la página", () => {
    const drafts = [{ name: "Ana", code: "A1", email: "a@u.edu", course: "MAT" }];

    test("tras importar estudiantes con éxito recarga la lista desde el backend", async () => {
        mockBulkImport.mockResolvedValue({ success: 1, errors: [], credentials: { sent: 1, notSent: [] } });
        mockReloadStudents.mockResolvedValue(undefined);
        const getVm = renderVm();
        let result;
        await act(async () => {
            result = await getVm().importUsers(drafts, { privacyAccepted: true });
        });

        expect(mockBulkImport).toHaveBeenCalledWith(drafts, { privacyAccepted: true });
        expect(mockReloadStudents).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(1);
    });

    test("si no se creó nadie no recarga", async () => {
        mockBulkImport.mockResolvedValue({ success: 0, errors: [{ student: "Ana", reason: "x" }] });
        const getVm = renderVm();
        await act(async () => {
            await getVm().importUsers(drafts, { privacyAccepted: true });
        });

        expect(mockReloadStudents).not.toHaveBeenCalled();
    });

    test("un fallo al recargar no oculta el resultado de la importación", async () => {
        mockBulkImport.mockResolvedValue({ success: 2, errors: [] });
        mockReloadStudents.mockRejectedValue(new Error("429"));
        const getVm = renderVm();
        let result;
        await act(async () => {
            result = await getVm().importUsers(drafts, { privacyAccepted: true });
        });

        expect(result.success).toBe(2);
    });
});

test("rejects a TI document and a future birth date for staff edits", async () => {
    const getVm = renderVm();
    let tiErr;
    let dateErr;
    await act(async () => {
        tiErr = await getVm().updateUserDetails(target, { ...form, documentType: "TI" });
        dateErr = await getVm().updateUserDetails(target, { ...form, birthDate: "2999-01-01" });
    });

    expect(tiErr).toMatch(/Tipo de documento/);
    expect(dateErr).toMatch(/futura/);
    expect(authApi.updatePerson).not.toHaveBeenCalled();
});
