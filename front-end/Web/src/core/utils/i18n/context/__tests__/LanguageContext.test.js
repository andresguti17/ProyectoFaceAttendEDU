import React from "react";
import { create, act } from "react-test-renderer";
import { Text } from "react-native";
import { LanguageProvider, useLanguageContext, i18n } from "../LanguageContext";

let ctx;
function Probe({ onContext }) {
    const value = useLanguageContext();
    onContext(value);
    return <Text>{value.t("Guardar")}</Text>;
}

async function mount() {
    let root;
    await act(async () => {
        root = create(<LanguageProvider><Probe onContext={(value) => { ctx = value; }} /></LanguageProvider>);
    });
    return root;
}

describe("LanguageContext (fachada i18next)", () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => act(() => i18n.changeLanguage("es")));

    it("arranca en español y devuelve el literal como clave", async () => {
        const root = await mount();
        expect(ctx.language).toBe("es");
        expect(root.root.findByType(Text).props.children).toBe("Guardar");
    });

    it("cambia de idioma, re-renderiza y guarda la preferencia", async () => {
        const root = await mount();
        await act(() => ctx.setLanguage("fr"));
        expect(root.root.findByType(Text).props.children).toBe("Enregistrer");
        expect(localStorage.getItem("faceattend_language")).toBe("fr");
    });

    it("restaura el idioma guardado y descarta uno no soportado", async () => {
        localStorage.setItem("faceattend_language", "pt");
        await mount();
        expect(ctx.language).toBe("pt");
        expect(ctx.t("Guardar")).toBe("Salvar");

        localStorage.setItem("faceattend_language", "de");
        await mount();
        expect(ctx.language).toBe("es");
    });

    it("ignora un setLanguage a un idioma no soportado", async () => {
        await mount();
        await act(() => ctx.setLanguage("de"));
        expect(ctx.language).toBe("es");
        expect(localStorage.getItem("faceattend_language")).toBeNull();
    });

    it("interpola variables también sin traducción (es)", async () => {
        await mount();
        expect(ctx.t("{{name}} excede el tamaño máximo de {{size}}", { name: "a.pdf", size: "5 MB" }))
            .toBe("a.pdf excede el tamaño máximo de 5 MB");
    });
});
