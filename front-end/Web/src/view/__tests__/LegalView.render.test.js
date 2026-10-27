// La política de privacidad y los términos son páginas distintas, sin sesión.
import React from "react";
import { create, act } from "react-test-renderer";
import { ThemeProvider } from "../../context/ThemeContext";
import { ResponsiveProvider } from "../../context/ResponsiveContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}` }));

import LegalView, { LEGAL_DOCS } from "../LegalView";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function textOf(node) {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(textOf).join(" ");
    return textOf(node.children);
}

function renderDoc(doc) {
    let root;
    act(() => {
        root = create(
            <SafeAreaProvider initialMetrics={METRICS}>
                <ThemeProvider><ResponsiveProvider><LegalView doc={doc} onBack={() => {}} /></ResponsiveProvider></ThemeProvider>
            </SafeAreaProvider>,
        );
    });
    return textOf(root.toJSON());
}

test("the privacy policy page shows the privacy notice and not the terms", () => {
    const text = renderDoc(LEGAL_DOCS.privacy);

    expect(text).toContain("Política de privacidad");
    expect(text).toContain("Responsable del tratamiento");
    expect(text).not.toContain("Versión de los términos");
});

test("the terms page shows the terms and not the privacy notice", () => {
    const text = renderDoc(LEGAL_DOCS.terms);

    expect(text).toContain("Versión de los términos");
    expect(text).toContain("Menores de edad");
    expect(text).not.toContain("Política de privacidad");
});
