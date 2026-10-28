import React from "react";
import { create, act } from "react-test-renderer";
import { TouchableOpacity, Switch as RNSwitch } from "react-native";
import { ThemeProvider } from "../../../../../context/ThemeContext";
import { Checkbox } from "../Checkbox";
import { Radio } from "../Radio";
import { Switch } from "../Switch";

// The icon font cannot load under jest; the icon keeps its name/size/color in the tree.
jest.mock("@expo/vector-icons", () => ({ Feather: (props) => `Feather:${props.name}:${props.size}:${props.color}` }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(element) {
    let root;
    act(() => {
        root = create(<ThemeProvider>{element}</ThemeProvider>);
    });
    return root;
}

// The render tree is pinned for every variant, size and state these inputs support:
// the shared label/description/error pieces must keep producing exactly this output.
const CASES = [
    { label: "Acepto", description: "Detalle" },
    { label: "Activo", variant: "success", size: "lg" },
    { label: "Peligro", variant: "danger", size: "sm", disabled: true },
    { label: "Con error", error: true, errorMessage: "Campo requerido" },
    { description: "Solo descripción", variant: "warning" },
    {},
];

describe("Checkbox / Radio / Switch render", () => {
    test.each(CASES.map((props, i) => [i, props]))("Checkbox case %i", (_i, props) => {
        expect(render(<Checkbox checked {...props} />).toJSON()).toMatchSnapshot();
        expect(render(<Checkbox indeterminate {...props} />).toJSON()).toMatchSnapshot();
    });

    test.each(CASES.map((props, i) => [i, props]))("Radio case %i", (_i, props) => {
        expect(render(<Radio selected {...props} />).toJSON()).toMatchSnapshot();
        expect(render(<Radio {...props} />).toJSON()).toMatchSnapshot();
    });

    test.each(CASES.map((props, i) => [i, props]))("Switch case %i", (_i, props) => {
        expect(render(<Switch value {...props} />).toJSON()).toMatchSnapshot();
    });

    test("toggling reports the next value; indeterminate goes to checked", () => {
        const onToggle = jest.fn();
        let tree = render(<Checkbox checked onToggle={onToggle} label="x" />);
        act(() => tree.root.findByType(TouchableOpacity).props.onPress());
        tree = render(<Checkbox indeterminate onToggle={onToggle} label="x" />);
        act(() => tree.root.findByType(TouchableOpacity).props.onPress());
        tree = render(<Checkbox disabled onToggle={onToggle} label="x" />);
        act(() => tree.root.findByType(TouchableOpacity).props.onPress());
        expect(onToggle.mock.calls).toEqual([[false], [true]]);
    });

    test("radio and switch forward their events", () => {
        const onPress = jest.fn();
        const onValueChange = jest.fn();
        const radio = render(<Radio onPress={onPress} label="x" />);
        act(() => radio.root.findByType(TouchableOpacity).props.onPress());
        const toggle = render(<Switch value={false} onValueChange={onValueChange} label="x" />);
        act(() => toggle.root.findByType(RNSwitch).props.onValueChange(true));
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(onValueChange).toHaveBeenCalledWith(true);
    });
});
