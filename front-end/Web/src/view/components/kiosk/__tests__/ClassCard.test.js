import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("../../common/cards/Card", () => {
    const { View } = require("react-native");
    const React = require("react");
    return { Card: ({ children }) => React.createElement(View, null, children) };
});
jest.mock("../../common/buttons/Button", () => {
    const { Text } = require("react-native");
    const React = require("react");
    return {
        Button: ({ children, onPress }) => React.createElement(Text, { onPress, accessibilityRole: "button" }, children),
    };
});
jest.mock("../../common/badges/Badge", () => {
    const { Text } = require("react-native");
    const React = require("react");
    return { Badge: ({ children }) => React.createElement(Text, null, children) };
});
jest.mock("../../hooks/useTheme", () => ({
    useTheme: () => ({
        theme: { colors: new Proxy({}, { get: () => new Proxy({}, { get: () => "#000" }) }) },
    }),
}));
jest.mock("../../../../core/utils/i18n/hooks/useTranslation", () => ({
    useTranslation: () => ({ t: (s) => s }),
}));

import ClassCard from "../ClassCard";

const block = { scheduleBlockId: 1, startsAt: "07:00:00", endsAt: "09:00:00" };
const details = {
    courseName: "Controlar la calidad",
    courseCode: "CCS",
    fichaCode: "3145556",
    environmentName: "Aula 204",
    capacity: 30,
    enrolled: 23,
    status: "pending",
    registered: null,
};
const at = (h, m = 0) => new Date(2026, 9, 19, h, m);

function render(props) {
    let tree;
    act(() => {
        tree = create(<ClassCard block={block} onStart={jest.fn()} now={at(6, 25)} {...props} />);
    });
    return tree;
}

const textOf = (tree) =>
    JSON.stringify(tree.toJSON())
        .replace(/\\"/g, '"')
        .replace(/"([^"]*)"/g, " $1 ");

test("a pending class shows course, ficha, schedule, environment and roster size with a start button", () => {
    const onStart = jest.fn();
    const tree = render({ details, onStart });
    const text = textOf(tree);

    expect(text).toContain("Controlar la calidad");
    expect(text).toContain("Ficha 3145556");
    expect(text).toContain("Código CCS");
    expect(text).toContain("Sin iniciar");
    expect(text).toContain("07:00 – 09:00");
    expect(text).toContain("2 h · Empieza en 35 min");
    expect(text).toContain("Aula 204");
    expect(text).toContain("Capacidad 30");
    expect(text).toContain("23 matriculados");

    const button = tree.root.findByProps({ accessibilityRole: "button" });
    expect(button.props.children).toBe("Iniciar clase");
    act(() => button.props.onPress());
    expect(onStart).toHaveBeenCalledWith(block);
});

test("an open class shows live attendance and offers to continue", () => {
    const tree = render({
        details: { ...details, status: "open", registered: 12 },
        now: at(7, 50),
    });
    const text = textOf(tree);

    expect(text).toContain("En curso");
    expect(text).toContain("12 de 23");
    expect(text).toContain("Quedan 1 h 10 min");
    expect(tree.root.findByProps({ accessibilityRole: "button" }).props.children).toBe("Continuar clase");
});

test("a closed class summarises attendance and has no action", () => {
    const tree = render({
        details: { ...details, status: "closed", registered: 21 },
        now: at(12, 0),
    });
    const text = textOf(tree);

    expect(text).toContain("Cerrada");
    expect(text).toContain("21 de 23");
    expect(text).toContain("91 % presentes");
    expect(text).toContain("Terminó hace 3 h");
    expect(tree.root.findAllByProps({ accessibilityRole: "button" })).toHaveLength(0);
});

test("a cancelled class says so and has no action", () => {
    const tree = render({ details: { ...details, status: "cancelled" }, now: at(8, 0) });

    expect(textOf(tree)).toContain("Cancelada");
    expect(textOf(tree)).toContain("Clase cancelada");
    expect(tree.root.findAllByProps({ accessibilityRole: "button" })).toHaveLength(0);
});

test("without details it falls back to the plain card instead of breaking", () => {
    const tree = render({ details: undefined });
    const text = textOf(tree);

    expect(text).toContain("Clase de hoy");
    expect(text).toContain("07:00 – 09:00");
    expect(text).toContain("0 matriculados");
    expect(tree.root.findByProps({ accessibilityRole: "button" }).props.children).toBe("Iniciar clase");
});

test("while details load it asserts no state and offers no action", () => {
    const tree = render({ details: undefined, loading: true });
    const text = textOf(tree);

    expect(text).toContain("Cargando…");
    expect(text).toContain("07:00 – 09:00");
    expect(text).not.toContain("Sin iniciar");
    expect(text).not.toContain("0 matriculados");
    expect(tree.root.findAllByProps({ accessibilityRole: "button" })).toHaveLength(0);
});

test("refreshing keeps the previous details visible but hides the action until it settles", () => {
    const tree = render({ details: { ...details, status: "open", registered: 12 }, loading: true });
    const text = textOf(tree);

    expect(text).toContain("Controlar la calidad");
    expect(tree.root.findAllByProps({ accessibilityRole: "button" })).toHaveLength(0);
});
