import React, { createRef } from "react";
import { create, act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../../../../context/ThemeContext";
import { ResponsiveProvider } from "../../../../context/ResponsiveContext";
import { DateRangeCalendar, Checkbox } from "../../../components/common";
import { TouchableOpacity } from "react-native";
import { HistoricosSection } from "../sections/HistoricalSection";
import { exportToExcel, exportToPDF } from "../../../../core/utils/exportHelpers";

// Icon fonts cannot load under jest; the icon keeps its name/size/color in the tree.
jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.size}:${props.color}` }));
jest.mock("react-dom", () => ({ ...jest.requireActual("react-dom"), createPortal: (node) => node }));
jest.mock("../../../components/reports/UserHistoryModal", () => () => null);
jest.mock("../../../components/reports/ExportConfigModal", () => ({
    ExportConfigModal: (props) => require("react").createElement("ExportConfigModal", props),
}));
jest.mock("../../../components/common/feedback/PushNotification", () => {
    const notify = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
    return { usePushNotification: () => notify };
});
// Exports are captured instead of downloaded; the HTML/table builders stay real.
jest.mock("../../../../core/utils/exportHelpers", () => ({
    ...jest.requireActual("../../../../core/utils/exportHelpers"),
    exportToExcel: jest.fn(async () => ({ success: true })),
    exportToPDF: jest.fn(() => ({ success: true })),
}));

const mockAppData = {
    isLoading: false,
    students: [
        {
            id: "s1", name: "Ana Pérez", code: "1001", course: "2758", attendance: 90,
            attendanceHistory: [
                { date: "2026-10-01", present: true, checkInTime: "07:02", checkOutTime: "12:00" },
                { date: "2026-10-02", present: true, late: true, checkInTime: "07:20", checkOutTime: "12:00" },
                { date: "2026-10-05", present: false },
            ],
        },
        {
            id: "s2", name: "Luis Gómez", code: "1002", course: "2760", attendance: 50,
            attendanceHistory: [{ date: "2026-10-03", present: false }],
        },
        { id: "s3", name: "Eva Ruiz", code: "1003", course: "9999", courseName: "Sin curso", attendance: 0 },
    ],
    courses: [
        { id: "c1", code: "2758", name: "ADSI", room: "e1" },
        { id: "c2", code: "2760", name: "Redes", room: "e2" },
    ],
    environments: [
        { id: "e1", number: "A-101", schedules: [{ courseCode: "2758", startTime: "07:00", endTime: "12:00", instructorName: "Prof. Rojas", instructor: "t1" }] },
        { id: "e2", number: "B-202", schedules: [{ courseCode: "otro", startTime: "13:00", endTime: "18:00", instructorName: "Prof. Díaz", instructor: "t2" }] },
    ],
};
jest.mock("../../../../context/AppDataContext", () => ({ useAppData: () => mockAppData }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function render(ref) {
    let root;
    act(() => {
        root = create(
            <SafeAreaProvider initialMetrics={METRICS}>
                <ThemeProvider><ResponsiveProvider>
                    <HistoricosSection ref={ref} showFilters />
                </ResponsiveProvider></ThemeProvider>
            </SafeAreaProvider>,
        );
    });
    return root;
}

function setRange(tree, start, end) {
    act(() => tree.root.findByType(DateRangeCalendar).props.onDateChange({ start, end }));
}

async function exportSelected(tree, format, type) {
    // The export-mode toggle is the touchable whose label reads "Exportar".
    const exportButton = tree.root.findAllByType(TouchableOpacity).find((n) =>
        n.findAll((x) => x.children?.includes?.("Exportar")).length > 0,
    );
    act(() => exportButton.props.onPress());
    act(() => tree.root.findAllByType(Checkbox)[0].props.onToggle());
    await act(async () => tree.root.findByType("ExportConfigModal").props.onExport(format, type));
}

const captured = () => ({
    excel: exportToExcel.mock.calls.map(([sheets, filename]) => ({ sheets, filename })),
    pdf: exportToPDF.mock.calls.map(([html, filename]) => ({ html, filename })),
});

describe("HistoricosSection render and exports", () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date("2026-10-26T15:00:00Z"));
        exportToExcel.mockClear();
        exportToPDF.mockClear();
    });
    afterEach(() => jest.useRealTimers());

    test("latest record per student", () => {
        expect(render(createRef()).toJSON()).toMatchSnapshot();
    });

    test("every record inside a date range", () => {
        const tree = render(createRef());
        setRange(tree, "2026-10-01", "2026-10-03");
        expect(tree.toJSON()).toMatchSnapshot();
    });

    test("full-list exports from the view model", async () => {
        const ref = createRef();
        render(ref);
        await act(async () => { await ref.current.exportExcel(); });
        act(() => { ref.current.exportPDF(); });
        expect(captured()).toMatchSnapshot();
    });

    test.each([
        ["excel", "simple", false],
        ["pdf", "simple", false],
        ["pdf", "detailed", false],
        ["pdf", "detailed", true],
        ["pdf", "simple", true],
    ])("selected rows to %s (%s, date range: %s)", async (format, type, withRange) => {
        const tree = render(createRef());
        if (withRange) setRange(tree, "2026-10-01", "2026-10-02");
        await exportSelected(tree, format, type);
        expect(captured()).toMatchSnapshot();
    });
});
