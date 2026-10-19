// ============================================================
//  FaceAttend EDU — PersonAutocomplete
//
//  Selector de persona para la pantalla Biometría: ms-biometric está indexado
//  por person_id (UUID), no por username, así que la captura ya no puede
//  tomar un texto libre — hay que elegir una persona real del directorio de
//  Identity. Mismo patrón que InstructorAutocomplete (AnimatedDropdown +
//  búsqueda integrada), pero sobre el listado de personas en lugar del de
//  instructores de un bloque horario.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { AnimatedDropdown } from "../common";
import { useTranslation } from "../../../core/utils/i18n/hooks/useTranslation";
import { listPersons, fullName } from "../../../services/api/referenceData";

export function PersonAutocomplete({ personId, onSelect, error }) {
    const { t } = useTranslation();
    const [persons, setPersons] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        listPersons()
            .then((data) => {
                if (!cancelled) setPersons(Array.isArray(data) ? data : []);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const items = useMemo(
        () =>
            persons.map((person) => ({
                value: person.personId,
                label: fullName(person) || person.personId,
                description: person.documentNumber ?? person.email ?? "",
                icon: "user",
                _raw: person,
            })),
        [persons]
    );

    return (
        <AnimatedDropdown
            items={items}
            value={personId || ""}
            onSelect={(selectedId) => {
                const selected = items.find((item) => item.value === selectedId);
                if (selected) onSelect(selected._raw);
            }}
            placeholder={loading ? t("Cargando personas...") : t("Buscar persona por nombre...")}
            triggerIcon="search"
            searchable={true}
            searchPlaceholder={t("Buscar persona...")}
            maxVisible={6}
            triggerHeight={48}
            error={error}
            style={{ marginBottom: 0 }}
        />
    );
}

export default PersonAutocomplete;
