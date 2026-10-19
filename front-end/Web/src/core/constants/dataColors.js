// ============================================================
//  FaceAttend EDU — dataColors
//
//  Paleta compartida para colorear entidades derivadas
//  (fichas, cursos). Uso: colorAt(index) → color estable
//  mientras el orden de la lista no cambie.
// ============================================================

export const DATA_COLORS = [
    "#4F6BED",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EF4444",
    "#06B6D4",
    "#F97316",
    "#84CC16",
];

export function colorAt(index) {
    return DATA_COLORS[index % DATA_COLORS.length];
}
