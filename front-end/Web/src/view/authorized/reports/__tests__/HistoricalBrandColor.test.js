import React, { createRef } from "react";
import { create, act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../../../../context/ThemeContext";
import { ResponsiveProvider } from "../../../../context/ResponsiveContext";
import { useTheme } from "../../../components/hooks/useTheme";
import { HistoricosSection } from "../sections/HistoricalSection";
import { exportToPDF } from "../../../../core/utils/exportHelpers";

// The theme has no `colors.primary`: the brand color lives in `colors.brand.primary`.
// Using the former printed "undefined" into the PDF stylesheet and the list highlights.

jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.color}` }));
jest.mock("../../../components/reports/UserHistoryModal", () => () => null);
jest.mock("../../../components/reports/ExportConfigModal", () => ({ ExportConfigModal: () => null }));
jest.mock("../../../components/common/feedback/PushNotification", () => {
    const notify = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
    return { usePushNotification: () => notify };
});
jest.mock("../../../../core/utils/exportHelpers", () => ({
    ...jest.requireActual("../../../../core/utils/exportHelpers"),
    exportToPDF: jest.fn(() => ({ success: true })),
}));
jest.mock("../../../../context/AppDataContext", () => ({
    useAppData: () => ({
        isLoading: false,
        students: [{ id: "s1", name: "Ana", code: "1001", course: "2758", attendance: 90,
            attendanceHistory: [{ date: "2026-10-01", present: true }] }],
        courses: [{ id: "c1", code: "2758", name: "ADSI" }],
        environments: [],
    }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function BrandProbe({ onBrand }) {
    onBrand(useTheme().theme.colors.brand.primary);
    return null;
}

function render(ref) {
    let brand;
    let tree;
    act(() => {
        tree = create(
            <SafeAreaProvider initialMetrics={METRICS}>
                <ThemeProvider><ResponsiveProvider>
                    <BrandProbe onBrand={(value) => { brand = value; }} />
                    <HistoricosSection ref={ref} showFilters />
                </ResponsiveProvider></ThemeProvider>
            </SafeAreaProvider>,
        );
    });
    return { tree, brand };
}

test("the full-list PDF uses the brand color for its header, values and table head", () => {
    const ref = createRef();
    const { brand } = render(ref);
    act(() => { ref.current.exportPDF(); });

    const html = exportToPDF.mock.calls[0][0];
    expect(html).not.toMatch(/undefined/);
    expect(html).toContain(`border-bottom: 3px solid ${brand};`);
    expect(html).toContain(`background: ${brand};`);
});

test("the active-filter chip uses the brand color", () => {
    const { tree, brand } = render(createRef());
    act(() => {
        tree.root.findAll((n) => n.props?.onChange && n.props?.value?.searchType)[0].props.onChange({ searchType: "student", searchText: "ana" });
    });
    const icons = JSON.stringify(tree.toJSON());
    expect(icons).toContain(`Feather:filter:${brand}`);
    expect(icons).not.toContain("Feather:filter:undefined");
});
