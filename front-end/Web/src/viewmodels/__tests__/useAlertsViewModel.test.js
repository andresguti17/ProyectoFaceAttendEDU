globalThis.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
const mockT = (s) => s;
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock("../../services/api/notificationApi", () => ({
    notificationApi: { listAlerts: jest.fn(), listAlertTypes: jest.fn() },
}));

import React from "react";
import { act, create } from "react-test-renderer";
import { notificationApi } from "../../services/api/notificationApi";
import { normalizeAlert, normalizeAlertType, useAlertsViewModel } from "../useAlertsViewModel";

// Forma real de GET /api/v1/alerts y /alert-types (Go sin etiquetas json).
const ALERT = {
    AlertID: 467, AcademicActorID: 1598, AlertTypeID: 3,
    RaisedAt: "2026-10-16T02:24:42.869438Z", ResolvedAt: null,
};
const TYPE = { AlertTypeID: 3, Code: "ATTENDANCE_LOW", Name: "Low attendance rate", Severity: "CRITICAL", Channel: "EMAIL" };

test("normalizes the PascalCase alert the notification service returns", () => {
    expect(normalizeAlert(ALERT)).toMatchObject({
        alertId: 467, academicActorId: 1598, alertTypeId: 3,
        raisedAt: "2026-10-16T02:24:42.869438Z", resolvedAt: null,
    });
});

test("normalizes the PascalCase alert type", () => {
    expect(normalizeAlertType(TYPE)).toMatchObject({
        alertTypeId: 3, code: "ATTENDANCE_LOW", name: "Low attendance rate", severity: "CRITICAL",
    });
});

test("still accepts snake_case payloads", () => {
    expect(normalizeAlert({ alert_id: 1, alert_type_id: 2, raised_at: "x", resolved_at: "y" }))
        .toMatchObject({ alertId: 1, alertTypeId: 2, raisedAt: "x", resolvedAt: "y" });
});

test("the view model exposes alerts with id, type, severity and date", async () => {
    notificationApi.listAlerts.mockResolvedValue({ alerts: [ALERT] });
    notificationApi.listAlertTypes.mockResolvedValue({ alert_types: [TYPE] });
    let vm;
    function Probe() {
        vm = useAlertsViewModel();
        return null;
    }
    await act(async () => {
        create(<Probe />);
    });
    expect(vm.alerts).toHaveLength(1);
    expect(vm.alerts[0].alertId).toBe(467);
    expect(vm.alerts[0].raisedAt).toBeTruthy();
    const type = vm.types.get(Number(vm.alerts[0].alertTypeId));
    expect(type.name).toBe("Low attendance rate");
    expect(type.severity).toBe("CRITICAL");
});
