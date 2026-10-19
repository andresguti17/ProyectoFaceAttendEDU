// ============================================================
//  FaceAttend EDU — useCityOptions
//
//  Opciones del selector de ciudad del formulario de sedes:
//  nombres en texto plano del catálogo externo countriesnow
//  (mismo origen que la app Mobile). Arranca con la lista local
//  de respaldo para que el campo nunca esté vacío y la reemplaza
//  por el catálogo completo cuando la respuesta llega.
// ============================================================

import { useEffect, useState } from "react";
import { FALLBACK_CITIES, fetchCityNames } from "../services/api/cityCatalog";

const toItems = (names) => names.map((name) => ({ value: name, label: name, icon: "map-pin" }));

export function useCityOptions() {
    const [items, setItems] = useState(() => toItems(FALLBACK_CITIES));

    useEffect(() => {
        let alive = true;
        fetchCityNames().then((names) => {
            if (alive) setItems(toItems(names));
        });
        return () => {
            alive = false;
        };
    }, []);

    return items;
}
