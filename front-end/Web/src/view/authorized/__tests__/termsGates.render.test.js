// Qué pantalla muestra AuthMiddleware según la edad y los términos: adulto de primer ingreso
// (firma), menor sin acudiente, menor con acudiente y términos pendientes, y menor habilitado.
import React from "react";
import { create, act } from "react-test-renderer";
import { ThemeProvider } from "../../../context/ThemeContext";
import { ResponsiveProvider } from "../../../context/ResponsiveContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

const METRICS = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}` }));
jest.mock("../AuthenticatedLayout", () => ({ children }) => children);
jest.mock("../ForcePasswordChange", () => () => "FORCE_PASSWORD");
jest.mock("../PrivacyConsentGate", () => () => "PRIVACY_GATE");
jest.mock("../../NotAuthorized", () => ({
    NotAuthorized: () => "NOT_AUTHORIZED",
    AUTH_EXCEPTION_TYPES: {},
}));
jest.mock("../../../viewmodels/useRolePermissions", () => ({
    useRolePermissions: () => ({ isAdmin: false, isTeacher: false, isStudent: true }),
}));

const mockAuth = { user: null, acceptTerms: jest.fn(), refreshTerms: jest.fn(), logout: jest.fn() };
jest.mock("../../../context/AuthContext", () => ({ useAuth: () => mockAuth }));

import AuthMiddleware from "../AuthMiddleware";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const Screen = () => "THE_SCREEN";
const Protected = AuthMiddleware(Screen);

function textOf(node) {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(textOf).join(" ");
    return textOf(node.children);
}

function renderFor(user) {
    mockAuth.user = { role: "student", mustChangePassword: false, consentRequired: false, ...user };
    let root;
    act(() => {
        root = create(
            <SafeAreaProvider initialMetrics={METRICS}>
                <ThemeProvider><ResponsiveProvider><Protected /></ResponsiveProvider></ThemeProvider>
            </SafeAreaProvider>,
        );
    });
    return textOf(root.toJSON());
}

beforeEach(() => jest.clearAllMocks());

test("an adult on the first login signs the terms before reaching the screen", () => {
    const text = renderFor({ termsGate: "ACCEPT", termsStep: "TERMS", isMinor: false });

    expect(text).toContain("Firmar y continuar");
    expect(text).not.toContain("THE_SCREEN");
});

test("the web terms alert mirrors the mobile modal: sign or leave, no extra checkbox", () => {
    const text = renderFor({ termsGate: "ACCEPT", termsStep: "TERMS", isMinor: false });

    expect(text).toContain("Términos y Condiciones");
    expect(text).toContain("1. Aceptación y objeto");
    expect(text).toContain("Firmar y continuar");
    expect(text).toContain("Salir sin firmar");
    expect(text).not.toContain("He leído y acepto");
});

test("a minor without a guardian sees the blocking alert with the guardian step", () => {
    const text = renderFor({ termsGate: "BLOCKED", termsStep: "GUARDIAN", isMinor: true });

    expect(text).toContain("Registro pendiente");
    expect(text).toContain("registrar a tu acudiente");
    expect(text).not.toContain("Firmar y continuar");
    expect(text).not.toContain("THE_SCREEN");
});

test("a minor with a guardian and pending terms sees the terms step, and cannot sign for themself", () => {
    const text = renderFor({ termsGate: "BLOCKED", termsStep: "TERMS", isMinor: true });

    expect(text).toContain("que tu acudiente acepte los términos");
    expect(text).not.toContain("Firmar y continuar");
    expect(text).not.toContain("THE_SCREEN");
});

test("a fully enabled minor and an adult with current terms reach the screen", () => {
    expect(renderFor({ termsGate: "NONE", termsStep: "NONE", isMinor: true })).toContain("THE_SCREEN");
    expect(renderFor({ termsGate: "NONE", termsStep: "NONE", isMinor: false })).toContain("THE_SCREEN");
});

test("a session saved before this feature (no flags) is not blocked", () => {
    expect(renderFor({})).toContain("THE_SCREEN");
});
