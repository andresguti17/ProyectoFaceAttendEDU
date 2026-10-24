import { maskTime } from "../TimeInput";

const type = (text, is24h, meridiem) => maskTime(text, is24h, meridiem);

test("24h: adds the colon, pads a first digit above 2 and clamps hours and minutes", () => {
    expect(type("0", true)).toMatchObject({ display: "0", internal: "" });
    expect(type("3", true)).toMatchObject({ display: "03", internal: "" });
    expect(type("0730", true)).toMatchObject({ display: "07:30", internal: "07:30" });
    expect(type("2599", true)).toMatchObject({ display: "23:59", internal: "23:59" });
    expect(type("07:3", true)).toMatchObject({ display: "07:3", internal: "" });
    expect(type("0775", true).display).toBe("07:59");
});

test("12h: completes with AM/PM and emits 24h", () => {
    expect(type("0730", false)).toMatchObject({ display: "07:30 AM", internal: "07:30" });
    expect(type("0730 p", false)).toMatchObject({ display: "07:30 PM", internal: "19:30" });
    expect(type("1200", false, "AM")).toMatchObject({ display: "12:00 AM", internal: "00:00" });
    expect(type("1200 PM", false)).toMatchObject({ display: "12:00 PM", internal: "12:00" });
});

test("12h: typing a 24h hour converts to the afternoon", () => {
    expect(type("1530", false)).toMatchObject({ display: "03:30 PM", internal: "15:30" });
    expect(type("0000", false).display).toBe("12:00 AM");
});

test("empty input stays empty", () => {
    expect(type("", true)).toMatchObject({ display: "", internal: "" });
    expect(type("abc", false)).toMatchObject({ display: "", internal: "" });
});
