// ============================================================
//  FaceAttend EDU — regla ESLint: estándar de botones
//
//  Los botones de la app toman su color de los tokens del tema que genera la
//  paleta elegida en Configuración > Apariencia (ver
//  src/view/components/common/buttons/buttonColors.js). Esta regla marca lo
//  que se sale de ese estándar:
//
//   1. <Button>/<IconButton> con color propio en style/textStyle
//      (usa `variant`).
//   2. <TouchableOpacity>/<Pressable> armados como botón relleno con
//      brand.primary / status.* sólido y fijo (usa <Button> o
//      <IconButton>). Un fondo condicional (`activo ? token : otro`) es un
//      control de selección (pestañas, chips, mosaicos), no un botón de acción,
//      y no se marca.
//   3. Blanco literal (#fff, #FFFFFF, "white") dentro de un botón o de sus
//      iconos (usa brand.textOnPrimary, status.*Text o getTextOnColor()).
//
//  Excepción puntual y justificada: un `// eslint-disable-next-line
//  faceattend/button-standard -- motivo` (p. ej. mosaicos de selección que no
//  son botones de acción).
// ============================================================

const SHARED_BUTTONS = new Set(["Button", "IconButton"]);
const RAW_TOUCHABLES = new Set(["TouchableOpacity", "Pressable"]);
const COLOR_KEYS = new Set(["backgroundColor", "borderColor", "color", "tintColor"]);
// Rellenos SÓLIDOS: brand.primary y status.* (primaryLight es la superficie suave de mosaicos/chips).
const FILL_TOKEN = /\b(?:brand\.primary(?![A-Za-z])|status\.(?:error|danger|success|warning)(?![A-Za-z]))/;
const WHITE = /^(?:#fff|#ffffff|white)$/i;

function elementName(opening) {
    return opening.name && opening.name.type === "JSXIdentifier" ? opening.name.name : null;
}

function attribute(opening, name) {
    return opening.attributes.find((a) => a.type === "JSXAttribute" && a.name && a.name.name === name);
}

// Objetos de estilo en línea de un atributo: {{...}} o [{...}, cond && {...}].
function styleObjects(attr, { unconditionalOnly = false } = {}) {
    const out = [];
    const visit = (node, conditional) => {
        if (!node) return;
        if (node.type === "ObjectExpression") { if (!(unconditionalOnly && conditional)) out.push(node); }
        else if (node.type === "ArrayExpression") node.elements.forEach((e) => visit(e, conditional));
        else if (node.type === "LogicalExpression") visit(node.right, true);
        else if (node.type === "ConditionalExpression") { visit(node.consequent, true); visit(node.alternate, true); }
    };
    if (attr && attr.value && attr.value.type === "JSXExpressionContainer") visit(attr.value.expression, false);
    return out;
}

function propertyKey(prop) {
    if (prop.type !== "Property") return null;
    if (prop.key.type === "Identifier") return prop.key.name;
    if (prop.key.type === "Literal") return String(prop.key.value);
    return null;
}

module.exports = {
    meta: {
        type: "problem",
        docs: { description: "Los botones deben seguir el estándar de color del tema (Button / IconButton)." },
        schema: [],
        messages: {
            colorOverride:
                "No cambies el color de un <{{name}}> por style/textStyle: elige una `variant` (el color sale del tema).",
            handmadeButton:
                "Botón armado a mano con {{token}}: usa <Button> o <IconButton> para seguir la paleta de Configuración.",
            literalWhite:
                "Blanco literal dentro de un botón: usa brand.textOnPrimary, status.*Text o getTextOnColor().",
        },
    },

    create(context) {
        const source = context.sourceCode || context.getSourceCode();
        // Profundidad dentro de botones (compartidos o crudos): ahí no se admite blanco literal.
        let buttonDepth = 0;
        const stack = [];

        return {
            JSXElement(node) {
                const opening = node.openingElement;
                const name = elementName(opening);
                const isButtonLike = name && (SHARED_BUTTONS.has(name) || RAW_TOUCHABLES.has(name));
                stack.push(isButtonLike);
                if (isButtonLike) buttonDepth += 1;

                if (!name) return;

                if (SHARED_BUTTONS.has(name)) {
                    for (const attrName of ["style", "textStyle"]) {
                        const attr = attribute(opening, attrName);
                        for (const obj of styleObjects(attr)) {
                            if (obj.properties.some((p) => COLOR_KEYS.has(propertyKey(p)))) {
                                context.report({ node: attr, messageId: "colorOverride", data: { name } });
                                break;
                            }
                        }
                    }
                }

                if (RAW_TOUCHABLES.has(name)) {
                    const attr = attribute(opening, "style");
                    for (const obj of styleObjects(attr, { unconditionalOnly: true })) {
                        for (const prop of obj.properties) {
                            if (propertyKey(prop) !== "backgroundColor") continue;
                            // Solo el fondo fijo con el token: es un botón de acción.
                            if (prop.value.type !== "MemberExpression") continue;
                            const match = FILL_TOKEN.exec(source.getText(prop.value));
                            if (match) {
                                context.report({ node: prop, messageId: "handmadeButton", data: { token: match[0] } });
                            }
                        }
                    }
                }
            },

            "JSXElement:exit"() {
                if (stack.pop()) buttonDepth -= 1;
            },

            Literal(node) {
                if (buttonDepth === 0 || typeof node.value !== "string" || !WHITE.test(node.value)) return;
                const parent = node.parent;
                const isColorAttr =
                    (parent.type === "JSXAttribute" && parent.name && parent.name.name === "color") ||
                    (parent.type === "JSXExpressionContainer" &&
                        parent.parent.type === "JSXAttribute" && parent.parent.name.name === "color");
                const isColorProp = parent.type === "Property" && propertyKey(parent) === "color" && parent.value === node;
                if (isColorAttr || isColorProp) context.report({ node, messageId: "literalWhite" });
            },
        };
    },
};
