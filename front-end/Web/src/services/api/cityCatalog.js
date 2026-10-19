// ============================================================
//  FaceAttend EDU — cityCatalog
//
//  Catálogo externo de ciudades (countriesnow.space), el mismo
//  origen que consume la app Mobile. Devuelve nombres en texto
//  plano: el formulario de sedes los muestra en un dropdown y
//  guarda school.cityName — antes el formulario pedía un ID
//  numérico del "catálogo externo" que el usuario no podía
//  adivinar.
//
//  Si la red falla (sin internet, CORS, 5xx) se usa una lista
//  local de respaldo para que el campo nunca quede inutilizable.
// ============================================================

const COUNTRIES_API = "https://countriesnow.space/api/v0.1";

// Respaldo offline: las ciudades capitales más relevantes.
export const FALLBACK_CITIES = [
    "Bogotá",
    "Medellín",
    "Cali",
    "Barranquilla",
    "Cartagena",
    "Cúcuta",
    "Bucaramanga",
    "Santa Marta",
    "Ibagué",
    "Manizales",
    "Neiva",
    "Pereira",
    "Popayán",
    "Villavicencio",
    "Montería",
    "Armenia",
    "Pasto",
    "Sincelejo",
    "Valledupar",
    "Riohacha",
];

export async function fetchCityNames(country = "Colombia") {
    try {
        const res = await fetch(`${COUNTRIES_API}/countries/cities`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country }),
            signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (!data.error && Array.isArray(data.data) && data.data.length > 0) {
            return data.data.filter((n) => typeof n === "string" && n.trim());
        }
        return [...FALLBACK_CITIES];
    } catch {
        return [...FALLBACK_CITIES];
    }
}
