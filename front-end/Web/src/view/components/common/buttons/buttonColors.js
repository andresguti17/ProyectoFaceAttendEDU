// ============================================================
//  FaceAttend EDU — Colores de botón (estándar de Configuración)
//
//  Única fuente de color de Button e IconButton. Todo sale de los tokens
//  del tema que genera la paleta elegida en Configuración > Apariencia
//  (generateTheme), así que un botón nunca lleva hex ni blanco fijo:
//  cambia con el acento, con el modo claro/oscuro y con la paleta semántica.
//
//    primary   fondo brand.primary          texto brand.textOnPrimary
//    secondary fondo brand.primaryLight     texto brand.primary
//    outline   transparente, borde brand.primary, texto brand.primary
//    ghost     transparente                 texto text.primary
//    danger    fondo status.error           texto status.errorText
//    success   fondo status.success         texto status.successText
//    warning   fondo status.warning         texto status.warningText
//    inverse   fondo brand.textOnPrimary    texto brand.primary         (sobre fondos de marca)
//    inverseOutline  transparente, borde y texto brand.textOnPrimary    (sobre fondos de marca)
//
//  Estados: deshabilitado usa interactive.disabled / disabledText;
//  hover y pulsado atenúan los rellenos y tiñen con interactive.hover /
//  pressed los botones transparentes (no tocan el color del texto, que ya
//  se calculó contra el fondo base).
// ============================================================

export const BUTTON_VARIANTS = [
    "primary", "secondary", "outline", "ghost", "danger", "success", "warning", "inverse", "inverseOutline",
];

// Variantes con fondo transparente (sin relleno cuando están deshabilitadas).
const TRANSPARENT = new Set(["outline", "ghost", "inverseOutline"]);
// Las que se tiñen con interactive.hover/pressed; el resto atenúa su relleno.
const TINTED = new Set(["outline", "ghost"]);

function baseColors(colors, variant) {
    const { brand, status, text } = colors;
    switch (variant) {
        case "secondary":
            return { backgroundColor: brand.primaryLight, borderColor: brand.primaryLight, color: brand.primary };
        case "outline":
            return { backgroundColor: "transparent", borderColor: brand.primary, color: brand.primary };
        case "ghost":
            return { backgroundColor: "transparent", borderColor: "transparent", color: text.primary };
        case "danger":
            return { backgroundColor: status.error, borderColor: status.error, color: status.errorText };
        case "success":
            return { backgroundColor: status.success, borderColor: status.success, color: status.successText };
        case "warning":
            return { backgroundColor: status.warning, borderColor: status.warning, color: status.warningText };
        case "inverse":
            return { backgroundColor: brand.textOnPrimary, borderColor: brand.textOnPrimary, color: brand.primary };
        case "inverseOutline":
            return { backgroundColor: "transparent", borderColor: brand.textOnPrimary, color: brand.textOnPrimary };
        case "primary":
        default:
            return { backgroundColor: brand.primary, borderColor: brand.primary, color: brand.textOnPrimary };
    }
}

/**
 * Colores de un botón para un estado.
 * @param {object} colors theme.colors
 * @param {string} variant uno de BUTTON_VARIANTS (otro valor cae en primary)
 * @param {{ disabled?: boolean, hovered?: boolean, pressed?: boolean }} state
 * @returns {{ backgroundColor: string, borderColor: string, color: string, opacity: number }}
 */
export function getButtonColors(colors, variant = "primary", { disabled = false, hovered = false, pressed = false } = {}) {
    const base = baseColors(colors, variant);
    const { interactive } = colors;

    if (disabled) {
        const transparent = TRANSPARENT.has(variant);
        return {
            backgroundColor: transparent ? "transparent" : interactive.disabled,
            borderColor: variant === "ghost" ? "transparent" : interactive.disabled,
            color: interactive.disabledText,
            opacity: 1,
        };
    }

    if (!hovered && !pressed) return { ...base, opacity: 1 };

    if (TINTED.has(variant)) {
        return { ...base, backgroundColor: pressed ? interactive.pressed : interactive.hover, opacity: 1 };
    }
    return { ...base, opacity: pressed ? 0.85 : 0.92 };
}
