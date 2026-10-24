// Paridad de recursos i18n (ADR-017, riesgo "claves inconsistentes entre idiomas")
// y cobertura: todo t("literal") del código tiene traducción en en/pt/fr.
const fs = require("fs");
const path = require("path");

const LOCALES = ["es", "en", "pt", "fr"];
const resources = Object.fromEntries(LOCALES.map((l) => [l, require(`../${l}.json`)]));

// Nombres propios, códigos y correos de ejemplo: se muestran igual en todos los idiomas.
const SAME_IN_ALL = new Set([
    "300 000 0000", "Ana Martínez", "Carlos Ramírez", "CIES-001", "contacto@institucion.edu",
    "correo@ejemplo.com", "correo@universidad.edu", "IE-001", "IS-2026", "María González",
    "SENA - Centro Industrial", "SENA Regional",
]);

const placeholders = (s) => (s.match(/\{\{\w+\}\}/g) || []).sort().join();

function literalKeys() {
    const root = path.resolve(__dirname, "../..");
    const files = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { if (!["__tests__", "locales"].includes(e.name)) walk(p); }
            else if (e.name.endsWith(".js")) files.push(p);
        }
    })(root);
    const re = /(?<![\w.$])t\(\s*(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)')\s*[,)]/g;
    const keys = new Set();
    for (const f of files) {
        for (const m of fs.readFileSync(f, "utf8").matchAll(re)) {
            const raw = m[1] ?? m[2];
            const key = raw.replace(/\\(["'\\])/g, "$1");
            if (key.trim()) keys.add(key);
        }
    }
    return keys;
}

describe("locales", () => {
    it("en, pt y fr tienen exactamente las mismas claves", () => {
        const en = Object.keys(resources.en).sort();
        expect(Object.keys(resources.pt).sort()).toEqual(en);
        expect(Object.keys(resources.fr).sort()).toEqual(en);
    });

    it("las claves semánticas de es existen en todos los idiomas", () => {
        for (const key of Object.keys(resources.es)) {
            for (const l of ["en", "pt", "fr"]) expect(resources[l]).toHaveProperty([key]);
        }
    });

    it("ninguna traducción está vacía ni pierde variables {{...}}", () => {
        for (const l of LOCALES) {
            for (const [key, value] of Object.entries(resources[l])) {
                expect(typeof value === "string" && value.length > 0).toBe(true);
                if (!key.includes(".") || /\s/.test(key)) expect(placeholders(value)).toBe(placeholders(key));
            }
        }
    });

    it("todo t(\"literal\") del código está traducido", () => {
        const missing = [...literalKeys()].filter((k) => !SAME_IN_ALL.has(k) && !(k in resources.en));
        expect(missing).toEqual([]);
    });
});
