import React from "react";
import { create, act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../../context/ThemeContext";
import { ResponsiveProvider } from "../../context/ResponsiveContext";
import LandingView from "../LandingView";

// Icon fonts cannot load under jest; the icon keeps its name/size/color in the tree.
jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.size}:${props.color}` }));

// Section backgrounds come from the landing config: each test picks with or without.
let mockBackgrounds = {};
jest.mock("../../core/config/landing.config", () => ({
    ...jest.requireActual("../../core/config/landing.config"),
    getSectionBackground: (key) => mockBackgrounds[key] ?? null,
}));

let mockWidth = 1440;
jest.mock("react-native-web/dist/exports/useWindowDimensions", () => ({
    __esModule: true,
    default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(width) {
    mockWidth = width;
    const metrics = { frame: { x: 0, y: 0, width, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
    let root;
    act(() => {
        root = create(
            <SafeAreaProvider initialMetrics={metrics}>
                <ThemeProvider><ResponsiveProvider><LandingView onNavigate={() => {}} /></ResponsiveProvider></ThemeProvider>
            </SafeAreaProvider>,
        );
    });
    return root;
}

const BG = {
    source: { uri: "bg.png" },
    blur: 2,
    opacity: 0.4,
    pattern: "dots",
    flipHorizontal: true,
    flipVertical: false,
    position: "center",
    overlayOpacity: 0.6,
};

describe("LandingView render", () => {
    test.each([1440, 375])("plain sections at %ipx", (width) => {
        mockBackgrounds = {};
        expect(render(width).toJSON()).toMatchSnapshot();
    });

    test("hero and testimonials with backgrounds", () => {
        mockBackgrounds = { hero: BG, testimonials: { ...BG, pattern: "grid", flipVertical: true } };
        expect(render(1440).toJSON()).toMatchSnapshot();
    });
});
