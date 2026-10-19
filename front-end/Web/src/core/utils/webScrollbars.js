// ============================================================
//  FaceAttend EDU — webScrollbars
//
//  React Native Web oculta la barra de scroll de todo lo que se
//  renderiza con showsVerticalScrollIndicator={false} /
//  showsHorizontalScrollIndicator={false} (le aplica la clase
//  r-scrollbarWidth-* con `scrollbar-width: none` y
//  `::-webkit-scrollbar { display: none }`). Casi todas las pantallas
//  usan esas props, así que en el navegador no había NINGUNA barra
//  visible para bajar por la ventana, aunque el contenido sí
//  scrolleaba con la rueda del ratón.
//
//  Este módulo restaura la barra nativa SOLO en web: `document` solo
//  existe en el navegador; en React Native el import no hace nada.
//  Se inyecta una única vez desde app.js.
// ============================================================

if (typeof document !== "undefined" && !document.getElementById("fae-web-scrollbars")) {
    const style = document.createElement("style");
    style.id = "fae-web-scrollbars";
    style.textContent = [
        // !important: vence a las reglas de RN-web (que no lo usan) por cualquier tema.
        "* { scrollbar-width: auto !important; scrollbar-color: rgba(100,116,139,.65) transparent; }",
        "*::-webkit-scrollbar { display: block !important; width: 12px; height: 12px; }",
        "*::-webkit-scrollbar-track { background: transparent; }",
        "*::-webkit-scrollbar-thumb {",
        "  background: rgba(100,116,139,.65);",
        "  background-clip: content-box;",
        "  border: 3px solid transparent;",
        "  border-radius: 8px;",
        "}",
        "*::-webkit-scrollbar-thumb:hover { background-color: rgba(100,116,139,.9); background-clip: content-box; }",
        "*::-webkit-scrollbar-corner { background: transparent; }",
    ].join("\n");
    document.head.appendChild(style);
}
