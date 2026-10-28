// ============================================================
//  FaceAttend EDU — UsersFilterBar
//
//  Barra de filtros de la gestión de usuarios (AdminUsers, TeacherUsers,
//  StudentUsers): buscador, filtro por columna y, si la vista lo pide, por curso.
// ============================================================

import React, { useMemo } from "react";
import { Select } from "../../../components/common";
import { SearchFilterBar } from "../../../components/common/filters";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";

/**
 * @param {object} vm - ViewModel de usuarios (useUsersViewModel)
 * @param {object} options - filterColumns, searchPlaceholder y showCourseFilter (todas opcionales)
 */
export default function UsersFilterBar({ vm, options = {} }) {
    const { t } = useTranslation();

    const filterColumns = useMemo(
        () =>
            options.filterColumns || [
                { key: "name", label: t("Nombre"), icon: "type" },
                { key: "program", label: t("Programa"), icon: "book" },
                { key: "attendance", label: t("Asistencia"), icon: "percent" },
                { key: "status", label: t("Estado"), icon: "activity" },
            ],
        [options.filterColumns, t],
    );

    return (
        <SearchFilterBar
            vm={vm}
            filterColumns={filterColumns}
            searchPlaceholder={options.searchPlaceholder || t("Buscar por nombre o código...")}
        >
            {/* Filtro por curso (opt-in: lo pide cada vista vía options) */}
            {options.showCourseFilter && (vm.courseOptions?.length ?? 0) > 0 && (
                <Select
                    value={vm.courseFilter}
                    onValueChange={vm.setCourseFilter}
                    options={vm.courseOptions}
                    placeholder={t("Todos los cursos")}
                    style={{ minWidth: 180 }}
                    searchable
                />
            )}
        </SearchFilterBar>
    );
}
