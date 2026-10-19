// ============================================================
//  FaceAttend EDU — Contacts ViewModel
// ============================================================
//  RESPONSABILIDAD: Contactos de la sede y de los instructores
//  (nav-map /contactos · mínima rol: alumno, instructor y admin)
//
//  La documentación solo enumera la ruta, sin contenido: se arma
//  con los datos que expone academic-service (sede) y los bloques
//  horarios (instructores y sus cursos).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { academicApi } from "../services/api";
import { actorMap, getActiveSchool, listBlocks, optional, personMap } from "../services/api/referenceData";

export function useContactsViewModel() {
    const { user } = useAuth();
    const appData = useAppData();
    const { t } = useTranslation();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [school, setSchool] = useState(null);
    const [instructors, setInstructors] = useState([]);

    const schoolId = user?.schoolId ?? getActiveSchool();

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [schoolData, blocks, actors, persons] = await Promise.all([
                schoolId != null ? optional(academicApi.getSchool(schoolId), null) : null,
                optional(listBlocks(), []),
                optional(actorMap(), null),
                optional(personMap(), null),
            ]);

            // Alcance: el alumno ve los instructores de su ficha, el instructor
            // los de sus fichas y el administrador todos los de la sede.
            let cohortIds = null;
            if (user?.role === "student") {
                const me = (appData.students || []).find((s) => s.personId === user.personId);
                cohortIds = me?.cohortId != null ? [String(me.cohortId)] : [];
            } else if (user?.role === "teacher") {
                cohortIds = [
                    ...new Set(
                        blocks
                            .filter((b) => Number(b.instructorActorId) === Number(user.academicActorId))
                            .map((b) => String(b.cohortId))
                    ),
                ];
            }

            const scopedBlocks =
                cohortIds == null
                    ? blocks
                    : blocks.filter((b) => cohortIds.includes(String(b.cohortId)));

            const coursesByActor = new Map();
            for (const block of scopedBlocks) {
                const actorId = Number(block.instructorActorId);
                if (!actorId) continue;
                const list = coursesByActor.get(actorId) ?? new Set();
                if (block.courseId != null) list.add(String(block.courseId));
                coursesByActor.set(actorId, list);
            }

            const courseName = (id) =>
                (appData.courses || []).find((c) => String(c.id ?? c.courseId) === String(id))?.name || "";

            const list = [];
            for (const [actorId, courseIds] of coursesByActor) {
                const actor = actors instanceof Map ? actors.get(actorId) : null;
                const person = actor && persons instanceof Map ? persons.get(actor.personId) : null;
                const name = person
                    ? `${person.name ?? ""} ${person.lastName ?? ""}`.trim()
                    : actor?.actorCode || `#${actorId}`;
                list.push({
                    id: actorId,
                    name,
                    email: person?.email || "",
                    phone: person?.phone || "",
                    courses: [...courseIds].map(courseName).filter(Boolean).join(", "),
                });
            }

            setSchool(schoolData);
            setInstructors(list.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (e) {
            setError(e?.message || t("No se pudieron cargar los contactos."));
        } finally {
            setIsLoading(false);
        }
    }, [schoolId, user, appData.students, appData.courses, t]);

    useEffect(() => {
        // El alcance por rol se calcula con el padrón de estudiantes de
        // AppDataContext: si se consulta antes de que termine de cargar, el
        // filtro de fichas da 0 instructores y no se vuelve a consultar.
        if (appData.isLoading) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appData.isLoading]);

    return { isLoading, error, school, instructors, refresh: load };
}
