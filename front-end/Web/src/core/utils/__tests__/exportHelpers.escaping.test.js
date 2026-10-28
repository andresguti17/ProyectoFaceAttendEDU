jest.mock("../../config/institutionConfig", () => ({ getInstitutionConfig: () => ({ dateFormat: "YYYY-MM-DD" }) }));

import {
    buildHTMLTable,
    buildReportHTML,
    escapeHtml,
    formatPercentageWithColor,
    formatStatusBadge,
    trustedHtml,
} from "../exportHelpers";

const PAYLOAD = '<img src=x onerror="alert(1)">';

describe("export helpers escape user data", () => {
    test("escapeHtml neutralizes markup and quotes", () => {
        expect(escapeHtml(PAYLOAD)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
        expect(escapeHtml(null)).toBe("");
    });

    test("plain cells and plain render results are escaped", () => {
        const html = buildHTMLTable(
            [{ name: PAYLOAD, course: PAYLOAD }],
            [{ key: "name", label: "Nombre" }, { key: "course", label: "Curso", render: (v) => v }],
        );
        expect(html).not.toContain("<img");
        expect(html.match(/&lt;img/g)).toHaveLength(2);
    });

    test("trusted render results keep their markup", () => {
        const html = buildHTMLTable([{ rate: 80 }], [{ key: "rate", label: "Tasa", render: (v) => trustedHtml(`<b>${v}</b>`) }]);
        expect(html).toContain("<b>80</b>");
    });

    test("column alignment only accepts known values", () => {
        const html = buildHTMLTable([{ a: 1 }], [{ key: "a", label: "A", align: 'left"><script>' }]);
        expect(html).not.toContain("<script>");
        expect(html).toContain("text-align: left");
    });

    test("badges and percentages escape what they print", () => {
        const badge = formatStatusBadge("x", { x: { text: PAYLOAD, color: "#000" } }).trustedHtml;
        expect(badge).not.toContain("<img");
        expect(formatPercentageWithColor(PAYLOAD).trustedHtml).not.toContain("<img");
    });

    test("report title, subtitle, filters, section titles and footer are escaped", () => {
        const html = buildReportHTML({
            title: PAYLOAD,
            subtitle: PAYLOAD,
            filters: [PAYLOAD],
            sections: [{ title: PAYLOAD, content: "<table></table>" }],
            footer: PAYLOAD,
        });
        expect(html).not.toContain("<img");
        expect(html).toContain("<table></table>");
    });
});
