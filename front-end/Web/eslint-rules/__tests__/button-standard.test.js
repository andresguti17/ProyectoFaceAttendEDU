/**
 * @jest-environment node
 */
const { RuleTester } = require("eslint");
const rule = require("../button-standard");

const tester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        parserOptions: { ecmaFeatures: { jsx: true } },
    },
});

describe("button-standard", () => {
    it("runs the RuleTester valid and invalid cases", () => {
        expect(typeof rule.create).toBe("function");
    });
});

tester.run("button-standard", rule, {
    valid: [
        // Botones compartidos solo con layout en style
        `const a = <Button variant="primary" style={{ marginTop: 12, flex: 1 }}>Guardar</Button>;`,
        `const a = <Button variant="outline" style={[{ minWidth: 120 }, wide && { width: "100%" }]} textStyle={{ fontSize: 12 }}>Ok</Button>;`,
        `const a = <IconButton variant="ghost" icon={(color) => <Feather name="x" size={18} color={color} />} />;`,
        // Iconos con tokens del tema
        `const a = <Button leftIcon={<Feather name="plus" size={16} color={c.brand.textOnPrimary} />}>Nuevo</Button>;`,
        // Control de selección: el relleno depende del estado (no es un botón de acción)
        `const a = <TouchableOpacity style={{ backgroundColor: active ? c.brand.primary : "transparent" }}><Text>Tab</Text></TouchableOpacity>;`,
        `const a = <TouchableOpacity style={[{ padding: 8 }, active && { backgroundColor: c.brand.primary }]}><Text>Chip</Text></TouchableOpacity>;`,
        // Superficie suave de mosaicos
        `const a = <TouchableOpacity style={{ backgroundColor: c.brand.primaryLight }}><Text>Tile</Text></TouchableOpacity>;`,
        // Overlay de modal y filas con fondos neutros
        `const a = <TouchableOpacity style={{ backgroundColor: c.background.overlay }} onPress={close}><View /></TouchableOpacity>;`,
        // Blanco fuera de botones
        `const a = <Text style={{ color: "#fff" }}>Hola</Text>;`,
        `const a = <View><Feather name="x" color="#fff" /></View>;`,
    ],

    invalid: [
        {
            code: `const a = <Button variant="primary" style={{ backgroundColor: c.background.surface }}>Ok</Button>;`,
            errors: [{ messageId: "colorOverride" }],
        },
        {
            code: `const a = <Button variant="outline" textStyle={{ color: c.text.primary }}>Ok</Button>;`,
            errors: [{ messageId: "colorOverride" }],
        },
        {
            code: `const a = <IconButton style={[{ margin: 4 }, { borderColor: "red" }]} />;`,
            errors: [{ messageId: "colorOverride" }],
        },
        {
            code: `const a = <TouchableOpacity style={{ backgroundColor: c.brand.primary, padding: 12 }}><Text>Guardar</Text></TouchableOpacity>;`,
            errors: [{ messageId: "handmadeButton" }],
        },
        {
            code: `const a = <Pressable style={{ backgroundColor: theme.colors.status.danger }}><Text>Borrar</Text></Pressable>;`,
            errors: [{ messageId: "handmadeButton" }],
        },
        {
            code: `const a = <Button leftIcon={<Feather name="plus" size={16} color="#fff" />}>Nuevo</Button>;`,
            errors: [{ messageId: "literalWhite" }],
        },
        {
            code: `const a = <Button><Text style={{ color: "white" }}>Continuar</Text></Button>;`,
            errors: [{ messageId: "literalWhite" }],
        },
        {
            code: `const a = <TouchableOpacity onPress={go}><Feather name="check" color="#FFFFFF" /></TouchableOpacity>;`,
            errors: [{ messageId: "literalWhite" }],
        },
    ],
});
