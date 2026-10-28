// Qué ve cada persona al ingresar según su edad y sus términos:
// adulto de primer ingreso, menor sin acudiente, menor con acudiente y términos
// pendientes, y menor completamente habilitado.
import { TERMS_GATE, isMinorPerson, resolveTermsGate } from "../termsGate";

const enablement = (over) => ({
    enabled: false,
    minor: false,
    guardianRegistered: false,
    termsUpToDate: false,
    pendingStep: "TERMS",
    ...over,
});

describe("resolveTermsGate", () => {
    test("an adult on the first login must read and sign the terms", () => {
        expect(resolveTermsGate(enablement({ minor: false, pendingStep: "TERMS" })))
            .toEqual({ gate: TERMS_GATE.ACCEPT, step: "TERMS", minor: false });
    });

    test("an adult who already signed the current terms is not asked again", () => {
        expect(resolveTermsGate(enablement({ enabled: true, termsUpToDate: true, pendingStep: "NONE" })).gate)
            .toBe(TERMS_GATE.NONE);
    });

    test("a minor without a guardian is blocked and told the guardian is missing", () => {
        expect(resolveTermsGate(enablement({ minor: true, pendingStep: "GUARDIAN" })))
            .toEqual({ gate: TERMS_GATE.BLOCKED, step: "GUARDIAN", minor: true });
    });

    test("a minor with a guardian but pending terms is blocked on the terms step", () => {
        expect(resolveTermsGate(enablement({ minor: true, guardianRegistered: true, pendingStep: "TERMS" })))
            .toEqual({ gate: TERMS_GATE.BLOCKED, step: "TERMS", minor: true });
    });

    test("a fully enabled minor goes in", () => {
        expect(resolveTermsGate(enablement({ minor: true, guardianRegistered: true, enabled: true, pendingStep: "NONE" })).gate)
            .toBe(TERMS_GATE.NONE);
    });

    test("a minor is never offered to sign for themself", () => {
        expect(resolveTermsGate(enablement({ minor: true, pendingStep: "TERMS" })).gate).not.toBe(TERMS_GATE.ACCEPT);
    });

    test("without an answer from identity nobody is blocked by the client", () => {
        expect(resolveTermsGate(null).gate).toBe(TERMS_GATE.NONE);
    });
});

describe("isMinorPerson", () => {
    const today = new Date("2026-10-27T12:00:00");

    test("the birth date decides", () => {
        expect(isMinorPerson({ birthDate: "2012-05-01" }, today)).toBe(true);
        expect(isMinorPerson({ birthDate: "2000-05-01" }, today)).toBe(false);
    });

    test("turns 18 exactly on the birthday", () => {
        expect(isMinorPerson({ birthDate: "2008-10-28" }, today)).toBe(true);
        expect(isMinorPerson({ birthDate: "2008-10-27" }, today)).toBe(false);
    });

    test("without a birth date a TI is treated as a minor and a CC as an adult", () => {
        expect(isMinorPerson({ documentType: "TI" }, today)).toBe(true);
        expect(isMinorPerson({ documentType: "CC" }, today)).toBe(false);
        expect(isMinorPerson({}, today)).toBe(false);
    });

    test("a TI holder who is already 18 is an adult", () => {
        expect(isMinorPerson({ birthDate: "2000-01-01", documentType: "TI" }, today)).toBe(false);
    });
});
