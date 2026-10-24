import { formatCurrency, formatNumber, formatPercentage } from "../formatting";

const missing = [null, undefined, Number.NaN, "no es un número"];

test.each(missing)("formatNumber falls back to 0 for %p", (value) => {
    expect(formatNumber(value)).toBe("0");
});

test.each(missing)("formatPercentage falls back to 0%% for %p", (value) => {
    expect(formatPercentage(value)).toBe("0%");
});

test.each(missing)("formatCurrency falls back to $0.00 for %p", (value) => {
    expect(formatCurrency(value)).toBe("$0.00");
});

test("a real zero is formatted, not treated as missing", () => {
    expect(formatPercentage(0)).toBe("0.00%");
});
