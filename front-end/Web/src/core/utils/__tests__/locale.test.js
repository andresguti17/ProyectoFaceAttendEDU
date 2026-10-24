import i18n from "../../../locales";
import { getLocale, formatDateTime } from "../locale";
import { getRelativeTime } from "../dates";
import { formatNumber } from "../formatting";

describe("locale", () => {
    afterEach(() => i18n.changeLanguage("es"));

    it("mapea cada idioma a su locale Intl", async () => {
        const expected = { es: "es-CO", en: "en-US", pt: "pt-BR", fr: "fr-FR" };
        for (const [lang, locale] of Object.entries(expected)) {
            await i18n.changeLanguage(lang);
            expect(getLocale()).toBe(locale);
        }
    });

    it("cae en es-CO con un idioma no soportado", async () => {
        await i18n.changeLanguage("de");
        expect(getLocale()).toBe("es-CO");
    });

    it("formatea fecha, número y tiempo relativo según el idioma", async () => {
        const date = new Date(2026, 9, 24, 14, 5);
        await i18n.changeLanguage("en");
        expect(formatDateTime(date)).toBe(new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(date));
        expect(formatNumber(1234567)).toBe("1,234,567");
        expect(getRelativeTime(new Date(Date.now() - 2 * 3600 * 1000))).toBe("2 hours ago");

        await i18n.changeLanguage("fr");
        expect(getRelativeTime(new Date(Date.now() - 2 * 3600 * 1000))).toBe("il y a 2 heures");
    });

    it("devuelve cadena vacía con una fecha inválida", () => {
        expect(formatDateTime("no es fecha")).toBe("");
    });
});
