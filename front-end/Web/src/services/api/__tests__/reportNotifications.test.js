jest.mock("../notificationApi", () => ({
    notificationApi: {
        listAlertTypes: jest.fn(),
        createAlert: jest.fn(),
    },
}));

import { notificationApi } from "../notificationApi";
import {
    notifyActors,
    notifyStudentByActorId,
    resolveAttendanceAlertType,
} from "../reportNotifications";

const TYPES = [
    { AlertTypeID: 7, Code: "JUSTIFICATION_PENDING", Name: "Pendiente" },
    { AlertTypeID: 3, Code: "ATTENDANCE_LOW", Name: "Baja" },
];

beforeEach(() => {
    jest.clearAllMocks();
    notificationApi.listAlertTypes.mockResolvedValue({ alert_types: TYPES });
    notificationApi.createAlert.mockResolvedValue({ alert_id: 1 });
});

test("resolves the attendance type by code, not by hardcoded id", async () => {
    await expect(resolveAttendanceAlertType()).resolves.toBe(3);
    expect(notificationApi.listAlertTypes).toHaveBeenCalledTimes(1);
});

test("falls back to the first type when no attendance code exists", async () => {
    notificationApi.listAlertTypes.mockResolvedValueOnce([
        { alert_type_id: 9, code: "CUSTOM" },
    ]);

    await expect(resolveAttendanceAlertType()).resolves.toBe(9);
});

test("throws when the backend exposes no alert types", async () => {
    notificationApi.listAlertTypes.mockResolvedValueOnce({ alert_types: [] });

    await expect(resolveAttendanceAlertType()).rejects.toThrow("No attendance alert type");
});

test("posts the alert with the snake_case contract", async () => {
    await notifyStudentByActorId("42");

    expect(notificationApi.createAlert).toHaveBeenCalledWith({
        academic_actor_id: 42,
        alert_type_id: 3,
    });
});

test("rejects local-only students without calling the backend", async () => {
    await expect(notifyStudentByActorId("local-abc")).rejects.toThrow("not synced");
    expect(notificationApi.createAlert).not.toHaveBeenCalled();
});

test("bulk notify resolves the type once and reports failures", async () => {
    notificationApi.createAlert.mockRejectedValueOnce(new Error("boom"));

    await expect(notifyActors(["10", "11"])).rejects.toThrow("1 of 2 notifications failed");
    expect(notificationApi.listAlertTypes).toHaveBeenCalledTimes(1);
});
