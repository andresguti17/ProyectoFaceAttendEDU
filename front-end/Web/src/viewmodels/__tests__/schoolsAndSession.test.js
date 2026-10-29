// Gestión de sedes (super admin) y cierre de sesión por inactividad.
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => {
    const translation = { t: (k) => k };
    return { useTranslation: () => translation };
});
jest.mock("../../context/AppDataContext", () => ({ useAppData: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/api", () => ({
    academicApi: { listSchools: jest.fn(), createSchool: jest.fn(), updateSchool: jest.fn(), updateSchoolStatus: jest.fn(), deleteSchool: jest.fn() },
}));

import { useAppData } from "../../context/AppDataContext";
import { useAuth } from "../../context/AuthContext";
import { academicApi } from "../../services/api";
import { saveInstitutionConfig, getDefaultInstitutionConfig } from "../../core/config/institutionConfig";
import { useSchoolsViewModel, validateSchoolForm, EMPTY_SCHOOL_FORM } from "../useSchoolsViewModel";
import { useSessionTimeout } from "../../core/hooks/useSessionTimeout";
import { renderHook, flush, act } from "./support/renderHook";

describe("schools", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        saveInstitutionConfig({ ...getDefaultInstitutionConfig(), minAttendance: 80 });
        useAuth.mockReturnValue({ user: { role: "admin", schoolId: null, roles: ["Super Administrador"] } });
        useAppData.mockReturnValue({
            students: [
                { schoolId: "2", status: "active", attendance: 78 },
                { schoolId: "2", status: "inactive", attendance: 90 },
                { schoolId: null, status: "active", attendance: 50 },
            ],
        });
        academicApi.listSchools.mockResolvedValue([
            { schoolId: 2, name: "Norte", code: "N", cityName: "Bogotá", status: true },
            { schoolId: 3, name: "Sur", code: "S", status: false },
        ]);
    });

    async function vm() {
        const hook = await renderHook(useSchoolsViewModel);
        await flush();
        return hook.result;
    }

    test("validation", () => {
        expect(validateSchoolForm({ ...EMPTY_SCHOOL_FORM }, false)).toBe("El nombre de la sede es obligatorio.");
        expect(validateSchoolForm({ ...EMPTY_SCHOOL_FORM, name: "Norte" }, false)).toBe("El código de la sede es obligatorio.");
        expect(validateSchoolForm({ ...EMPTY_SCHOOL_FORM, name: "Norte" }, true)).toBeNull();
        expect(validateSchoolForm({ ...EMPTY_SCHOOL_FORM, name: "N", code: "N", email: "x@" }, false)).toMatch(/correo/);
        expect(validateSchoolForm({ ...EMPTY_SCHOOL_FORM, name: "N", code: "N", phone: "123" }, false)).toMatch(/teléfono/);
        expect(validateSchoolForm({ ...EMPTY_SCHOOL_FORM, name: "N", code: "N", cityName: "x".repeat(101) }, false)).toMatch(/100/);
    });

    test("each school shows its learners, with at-risk counted against the configured minimum", async () => {
        const v = await vm();

        const norte = v().schools.find((s) => s.schoolId === 2);
        // 78 % está bajo el mínimo configurado (80 %), aunque supere el 75 % de los colores.
        expect(norte).toMatchObject({ students: 2, active: 1, atRisk: 1, avgAttendance: 84 });
        expect(v().schools.find((s) => s.schoolId === 3)).toMatchObject({ students: 0, avgAttendance: null });
        expect(v().stats).toEqual({ total: 2, activeSchools: 1, avgAttendance: 64 });
        expect(v().unassignedStudents).toBe(1);
        expect(v().canManage).toBe(true);
        act(() => v().setSearch("bogo"));
        expect(v().schools.map((s) => s.schoolId)).toEqual([2]);
    });

    test("creating, editing, toggling and deleting a school reload the list", async () => {
        const v = await vm();

        act(() => v().openCreate());
        act(() => {
            v().setField("name", " Centro ");
            v().setField("code", "C");
            v().setField("phone", "+57 300-123-4567");
        });
        expect(v().form.phone).toBe("573001234567");
        await act(async () => v().save());
        expect(academicApi.createSchool).toHaveBeenCalledWith({ name: "Centro", code: "C", phone: "573001234567", address: undefined, cityName: undefined, email: undefined });
        expect(v().feedback).toEqual({ type: "success", message: "Sede creada correctamente." });

        act(() => v().openEdit(v().schools[0]));
        expect(v()).toMatchObject({ modalMode: "edit", form: { name: "Norte", cityName: "Bogotá" } });
        academicApi.updateSchool.mockRejectedValueOnce(new Error("Código repetido"));
        await act(async () => v().save());
        expect(v().formError).toBe("Código repetido");
        act(() => v().closeModal());

        act(() => v().requestStatusChange(v().schools[0]));
        await act(async () => v().confirmStatusChange());
        expect(academicApi.updateSchoolStatus).toHaveBeenCalledWith(2, false);
        expect(v().feedback.message).toBe("Sede desactivada.");

        academicApi.deleteSchool.mockRejectedValueOnce(new Error("Tiene aprendices"));
        act(() => v().requestDelete(v().schools[1]));
        await act(async () => v().confirmDelete());
        expect(v().feedback).toEqual({ type: "error", message: "Tiene aprendices" });
        expect(v().deleteTarget).toBeNull();
        expect(academicApi.listSchools.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    test("an invalid form is not sent and a list failure is shown", async () => {
        const v = await vm();
        act(() => v().openCreate());
        await act(async () => v().save());
        expect(v().formError).toBe("El nombre de la sede es obligatorio.");
        expect(academicApi.createSchool).not.toHaveBeenCalled();

        academicApi.listSchools.mockRejectedValue(new Error("403"));
        const failing = await vm();
        expect(failing().error).toBe("403");
    });
});

describe("useSessionTimeout", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("warns in the last minutes and signs out once at zero", async () => {
        const onTimeout = jest.fn();
        const { result } = await renderHook(useSessionTimeout, { timeoutMinutes: 2, warningMinutes: 1, onTimeout });
        expect(result().timeRemainingFormatted).toBe("2:00");

        await act(async () => jest.advanceTimersByTime(61_000));
        expect(result().isWarning).toBe(true);
        await act(async () => jest.advanceTimersByTime(60_000));
        await act(async () => jest.advanceTimersByTime(5_000));

        expect(result()).toMatchObject({ isExpired: true, timeRemaining: 0 });
        expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    test("activity restarts the countdown; disabled it does nothing", async () => {
        const onTimeout = jest.fn();
        const { result } = await renderHook(useSessionTimeout, { timeoutMinutes: 1, warningMinutes: 1, onTimeout });
        await act(async () => jest.advanceTimersByTime(50_000));

        act(() => result().handleActivity());
        expect(result()).toMatchObject({ timeRemaining: 60, isWarning: false });
        await act(async () => jest.advanceTimersByTime(30_000));
        expect(onTimeout).not.toHaveBeenCalled();

        const off = await renderHook(useSessionTimeout, { timeoutMinutes: 1, onTimeout, enabled: false });
        await act(async () => jest.advanceTimersByTime(120_000));
        act(() => off.result().resetTimer());
        expect(off.result()).toMatchObject({ timeRemaining: 60, isExpired: false });
        act(() => off.result().clearTimer());
    });
});
