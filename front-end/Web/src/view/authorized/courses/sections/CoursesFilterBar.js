// ============================================================
//  FaceAttend EDU — CoursesFilterBar
//
//  Barra de filtros de la gestión de cursos (AdminCourses): buscador por
//  nombre/código/instructor y filtro por columna.
// ============================================================

import React, { useMemo } from "react";
import { SearchFilterBar } from "../../../components/common/filters";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

/**
 * @param {object} vm - ViewModel de cursos (useCoursesViewModel)
 * @param {object} options - filterColumns y searchPlaceholder (opcionales)
 */
export default function CoursesFilterBar({ vm, options = {} }) {
    const { t } = useTranslation();

    const filterColumns = useMemo(
        () =>
            options.filterColumns || [
                { key: "name", label: t("Nombre"), icon: "type" },
                { key: "code", label: t("Código"), icon: "hash" },
                { key: "instructor", label: t("Instructor"), icon: "user" },
                { key: "students", label: t("Estudiantes"), icon: "users" },
                { key: "attendance", label: t("Asistencia"), icon: "percent" },
                { key: "status", label: t("Estado"), icon: "activity" },
            ],
        [options.filterColumns, t],
    );

    return (
        <SearchFilterBar
            vm={vm}
            filterColumns={filterColumns}
            searchPlaceholder={options.searchPlaceholder || t("Buscar curso, código o instructor...")}
        />
    );
}
