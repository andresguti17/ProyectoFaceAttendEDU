import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { TextInput as RNTextInput } from "react-native";
import { ThemeProvider } from "../../../../../context/ThemeContext";
import { TextInput } from "../TextInput";

// LoginView y SignupView cablean el ojo a TextInput con
// type="password" + secureTextEntry={!showPassword}. El prop explícito debe
// imponerse a la config del type; si no, el toggle no mostraría nada.
function innerProps(extraProps) {
    let root;
    act(() => {
        root = create(
            <ThemeProvider>
                <TextInput
                    label="Contraseña"
                    value="secreto123"
                    onChangeText={() => {}}
                    type="password"
                    {...extraProps}
                />
            </ThemeProvider>
        );
    });
    return root.root.findByType(RNTextInput).props;
}

describe("TextInput password visibility (ojo de Login/Signup)", () => {
    it("masks the password by default with type=password", () => {
        expect(innerProps({}).secureTextEntry).toBe(true);
    });

    it("shows the password when secureTextEntry=false (ojo abierto)", () => {
        expect(innerProps({ secureTextEntry: false }).secureTextEntry).toBe(false);
    });

    it("masks the password when secureTextEntry=true (ojo cerrado)", () => {
        expect(innerProps({ secureTextEntry: true }).secureTextEntry).toBe(true);
    });
});
