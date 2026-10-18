import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockPatchStaff = jest.fn();
const mockAddStudent = jest.fn();

jest.mock("../../context/AppDataContext", () => ({
    useAppData: () => ({
        students: [],
        teachers: [],
        admins: [],
        courses: [],
        isLoading: false,
        addStudent: mockAddStudent,
        importStudents: jest.fn(),
        addUser: jest.fn(),
        patchStaff: mockPatchStaff,
    }),
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
