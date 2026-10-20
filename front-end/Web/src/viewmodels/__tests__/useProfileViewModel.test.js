import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockGetPerson = jest.fn();
const mockUpdateMyProfile = jest.fn();
const mockGetSchool = jest.fn();
const mockUpdateSessionUser = jest.fn();

jest.mock("../../services/api/authApi", () => ({
    authApi: {
        getPerson: (...a) => mockGetPerson(...a),
        updateMyProfile: (...a) => mockUpdateMyProfile(...a),
    },
}));
jest.mock("../../services/api/academicApi", () => ({
    academicApi: { getSchool: (...a) => mockGetSchool(...a) },
}));
jest.mock("../../context/AuthContext", () => ({
    useAuth: () => ({
        user: { personId: "p-1", schoolId: 3, username: "ana.perez", email: "ana@colegio.edu", role: "teacher", roles: ["Instructor"] },
        updateSessionUser: (...a) => mockUpdateSessionUser(...a),
    }),
}));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));

import { useProfileViewModel } from "../useProfileViewModel";

const PERSON = {
    personId: "p-1",
    name: "Ana",
    lastName: "Pérez",
    documentType: "CC",
    documentNumber: "123",
    email: "ana@colegio.edu",
    phone: "3000000000",
    address: "Calle 1",
    birthDate: "2000-05-17",
    bloodType: "O+",
};

async function renderVm() {
    let vm;
    function Probe() {
        vm = useProfileViewModel();
        return null;
    }
    await act(async () => {
        create(<Probe />);
    });
    return () => vm;
}

describe("useProfileViewModel", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetPerson.mockResolvedValue(PERSON);
        mockGetSchool.mockResolvedValue({ name: "Colegio Nuevo" });
    });

    it("loads the person and exposes the read-only account data", async () => {
        const getVm = await renderVm();

        expect(getVm().loading).toBe(false);
        expect(mockGetPerson).toHaveBeenCalledWith("p-1");
        expect(getVm().account).toMatchObject({
            fullName: "Ana Pérez",
            documentType: "CC",
            documentNumber: "123",
            username: "ana.perez",
            schoolName: "Colegio Nuevo",
        });
        expect(getVm().values.phone).toBe("3000000000");
        expect(getVm().dirty).toBe(false);
    });

    it("reports a load failure", async () => {
        mockGetPerson.mockRejectedValue({ message: "boom" });
        const getVm = await renderVm();
        expect(getVm().loadError).toBe("boom");
    });

    it("marks the form dirty and discards the edits", async () => {
        const getVm = await renderVm();
        act(() => getVm().setField("phone", "3111111111"));
        expect(getVm().dirty).toBe(true);

        act(() => getVm().discard());
        expect(getVm().values.phone).toBe("3000000000");
        expect(getVm().dirty).toBe(false);
    });

    it("asks for the current password only when the email changes", async () => {
        const getVm = await renderVm();
        expect(getVm().needsPassword).toBe(false);
        act(() => getVm().setField("email", "nueva@colegio.edu"));
        expect(getVm().needsPassword).toBe(true);
    });

    it("does not call the backend while the form is invalid", async () => {
        const getVm = await renderVm();
        act(() => getVm().setField("phone", "123"));
        let ok;
        await act(async () => { ok = await getVm().save(); });

        expect(ok).toBe(false);
        expect(getVm().errors.phone).toBeDefined();
        expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    });

    it("saves only the editable fields and refreshes the session email", async () => {
        mockUpdateMyProfile.mockResolvedValue({ ...PERSON, phone: "3111111111" });
        const getVm = await renderVm();
        act(() => getVm().setField("phone", "3111111111"));
        let ok;
        await act(async () => { ok = await getVm().save(); });

        expect(ok).toBe(true);
        expect(mockUpdateMyProfile).toHaveBeenCalledWith({
            phone: "3111111111",
            address: "Calle 1",
            birthDate: "2000-05-17",
            bloodType: "O+",
        });
        expect(mockUpdateSessionUser).toHaveBeenCalledWith({ email: "ana@colegio.edu" });
        expect(getVm().saved).toBe(true);
        expect(getVm().dirty).toBe(false);
    });

    it("shows a wrong current password next to its field", async () => {
        mockUpdateMyProfile.mockRejectedValue({ status: 400, message: "Current password is incorrect" });
        const getVm = await renderVm();
        act(() => getVm().setField("email", "nueva@colegio.edu"));
        act(() => getVm().setField("currentPassword", "mala"));
        await act(async () => { await getVm().save(); });

        expect(getVm().errors.currentPassword).toMatch(/no es correcta/);
        expect(getVm().saved).toBe(false);
    });

    it("shows a duplicated email next to the email field", async () => {
        mockUpdateMyProfile.mockRejectedValue({ status: 409, message: "uniqueness" });
        const getVm = await renderVm();
        act(() => getVm().setField("email", "otra@colegio.edu"));
        act(() => getVm().setField("currentPassword", "Secret123!"));
        await act(async () => { await getVm().save(); });

        expect(getVm().errors.email).toMatch(/Ya existe/);
    });
});
