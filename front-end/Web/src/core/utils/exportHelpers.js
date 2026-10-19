// ============================================================
//  FaceAttend EDU — Export Helpers
// ============================================================
//  Utilidades para exportar datos en diferentes formatos.
//  
//  Funcionalidades:
//  • Export a Excel (XLSX)
//  • Export a PDF (via impresión HTML)
//  • Construcción de HTML para reportes
//  • Construcción de filas Excel
//
//  Uso:
//    import { exportToExcel, exportToPDF } from '@/core/utils/exportHelpers';
//    
//    exportToExcel(data, sheets, filename);
//    exportToPDF(htmlContent, filename);
// ============================================================

import { Platform } from "react-native";
import { getInstitutionConfig } from "../config/institutionConfig";
import { formatDate } from "../constants/dateFormats";

/**
 * Exporta datos a un archivo Excel (.xlsx)
 * 
 * @param {Array<Object>} sheets - Array de hojas a exportar
 * @param {string} sheets[].name - Nombre de la hoja
 * @param {Array<Object>} sheets[].data - Datos de la hoja (array de objetos)
 * @param {Array<{wch: number}>} sheets[].columns - Anchos de columnas opcionales
 * @param {string} filename - Nombre del archivo a generar
 * 
 * @example
 * exportToExcel([
 *   { 
 *     name: "Estudiantes", 
 *     data: [{ Código: "123", Nombre: "Juan" }],
 *     columns: [{ wch: 12 }, { wch: 32 }]
 *   },
 *   { name: "Resumen", data: [...] }
 * ], "reporte.xlsx");
 */
export function exportToExcel(sheets, filename) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const XLSX = require("xlsx");

        const wb = XLSX.utils.book_new();

        // Agregar cada hoja al libro
        sheets.forEach(sheet => {
            const ws = XLSX.utils.json_to_sheet(sheet.data);
            
            // Aplicar anchos de columna si están definidos
            if (sheet.columns && sheet.columns.length > 0) {
                ws["!cols"] = sheet.columns;
            }
            
            XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        });

        // Escribir archivo
        XLSX.writeFile(wb, filename);
        
        return { success: true };
    } catch (err) {
        console.error("[exportHelpers] Error al exportar Excel:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Exporta contenido HTML a PDF mediante impresión del navegador
 * 
 * Solo funciona en web. En otras plataformas retorna error.
 * 
 * @param {string} htmlContent - Contenido HTML completo del documento
 * @param {string} title - Título del documento (opcional)
 * 
 * @example
 * const html = `
 *   <!DOCTYPE html>
 *   <html><body><h1>Reporte</h1></body></html>
 * `;
 * exportToPDF(html, "Mi Reporte");
 */
export function exportToPDF(htmlContent, title = "Documento") {
    if (Platform.OS !== "web") {
        console.warn("[exportHelpers] La exportación PDF solo está disponible en web.");
        return { success: false, error: "PDF export only available on web" };
    }

    try {
        const win = window.open("", "_blank");
        
        if (!win) {
            console.error("[exportHelpers] No se pudo abrir ventana para PDF. Verifica bloqueador de pop-ups.");
            return { success: false, error: "Popup blocked" };
        }

        win.document.write(htmlContent);
        win.document.close();
        win.focus();

        // Pequeño delay para asegurar que el contenido se renderice
        setTimeout(() => {
            win.print();
        }, 400);

        return { success: true };
    } catch (err) {
        console.error("[exportHelpers] Error al exportar PDF:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Construye un documento HTML completo para reportes
 * 
 * Incluye estilos base y estructura estándar para impresión.
 * 
 * @param {Object} config - Configuración del reporte
 * @param {string} config.title - Título del reporte
 * @param {string} config.subtitle - Subtítulo (opcional)
 * @param {Array<string>} config.filters - Tags de filtros aplicados (opcional)
 * @param {Array<Object>} config.sections - Secciones del reporte
 * @param {string} config.sections[].title - Título de la sección
 * @param {string} config.sections[].content - Contenido HTML de la sección
 * @param {string} config.footer - Texto del footer (opcional)
 * 
 * @returns {string} HTML completo del documento
 * 
 * @example
 * const html = buildReportHTML({
 *   title: "Reporte de Asistencia",
 *   subtitle: "Período: Enero 2024",
 *   filters: ["Programa: TI", "Solo en riesgo"],
 *   sections: [
 *     { title: "Estudiantes", content: "<table>...</table>" },
 *     { title: "Resumen", content: "<div>...</div>" }
 *   ],
 *   footer: "FaceAttend EDU - Generado automáticamente"
 * });
 */
export function buildReportHTML({
    title,
    subtitle = "",
    filters = [],
    sections = [],
    footer = "FaceAttend EDU — Reporte generado automáticamente",
}) {
    const config = getInstitutionConfig();
    const currentDate = formatDate(new Date(), config.dateFormat);
    
    const filterTags = filters.length > 0
        ? `<div style="margin-bottom:16px">${filters.map(f => 
            `<span class="filter-tag">${f}</span>`
        ).join("")}</div>`
        : "";

    const sectionsHTML = sections.map(section => `
        <div class="section-title">${section.title}</div>
        ${section.content}
    `).join("");

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 32px; 
            color: #1a1a2e; 
        }
        h1 { 
            font-size: 20px; 
            margin-bottom: 4px; 
        }
        .subtitle { 
            color: #666; 
            font-size: 13px; 
            margin-bottom: 20px; 
        }
        .filter-tag { 
            display: inline-block; 
            background: #EEF2FF; 
            color: #4F6BED;
            padding: 3px 10px; 
            border-radius: 99px; 
            font-size: 12px; 
            margin-right: 6px; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 16px; 
            font-size: 13px; 
        }
        th { 
            background: #4F6BED; 
            color: #fff; 
            padding: 8px 12px; 
            text-align: left; 
        }
        td { 
            padding: 7px 12px; 
            border-bottom: 1px solid #e5e7eb; 
        }
        tr:nth-child(even) td { 
            background: #f9fafb; 
        }
        .section-title { 
            font-size: 15px; 
            font-weight: bold; 
            margin: 24px 0 8px; 
            border-bottom: 2px solid #4F6BED; 
            padding-bottom: 4px; 
        }
        .footer { 
            margin-top: 32px; 
            font-size: 11px; 
            color: #999; 
            text-align: center; 
        }
        @media print { 
            body { margin: 16px; } 
        }
    </style>
</head>
<body>
    <h1>📊 ${title}</h1>
    <div class="subtitle">
        ${subtitle ? `<strong>${subtitle}</strong> &nbsp;|&nbsp; ` : ""}
        Generado: ${currentDate}
    </div>
    ${filterTags}
    ${sectionsHTML}
    <div class="footer">${footer}</div>
</body>
</html>`;
}

/**
 * Construye una tabla HTML a partir de un array de objetos
 * 
 * Útil para construir secciones de reportes.
 * 
 * @param {Array<Object>} data - Array de objetos con los datos
 * @param {Array<Object>} columns - Configuración de columnas
 * @param {string} columns[].key - Clave del objeto
 * @param {string} columns[].label - Label de la columna
 * @param {Function} columns[].render - Función de renderizado (opcional)
 * @param {string} columns[].align - Alineación (left|center|right)
 * 
 * @returns {string} HTML de la tabla
 * 
 * @example
 * buildHTMLTable(
 *   [{ codigo: "123", nombre: "Juan", asistencia: 85 }],
 *   [
 *     { key: "codigo", label: "Código" },
 *     { key: "nombre", label: "Nombre" },
 *     { 
 *       key: "asistencia", 
 *       label: "Asistencia",
 *       align: "center",
 *       render: (value) => `<strong style="color: ${value < 75 ? 'red' : 'green'}">${value}%</strong>`
 *     }
 *   ]
 * );
 */
export function buildHTMLTable(data, columns) {
    const headers = columns.map(col => 
        `<th style="text-align: ${col.align || 'left'}">${col.label}</th>`
    ).join("");

    const rows = data.map(row => {
        const cells = columns.map(col => {
            const value = row[col.key];
            const rendered = col.render ? col.render(value, row) : value;
            return `<td style="text-align: ${col.align || 'left'}">${rendered}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
    }).join("");

    return `
        <table>
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

/**
 * Formatea un número como porcentaje con color
 * 
 * Helper para usar en renders de tablas.
 * 
 * @param {number} value - Valor numérico (0-100)
 * @param {number} warningThreshold - Umbral de advertencia (default: 75)
 * @param {number} dangerThreshold - Umbral de peligro (default: 60)
 * @returns {string} HTML del porcentaje con color
 */
export function formatPercentageWithColor(value, warningThreshold = 75, dangerThreshold = 60) {
    const color = value >= warningThreshold 
        ? "#10B981"  // Verde
        : value >= dangerThreshold 
        ? "#F59E0B"  // Amarillo
        : "#EF4444"; // Rojo
    
    return `<strong style="color: ${color}">${value}%</strong>`;
}

/**
 * Formatea un estado con badge
 * 
 * Helper para usar en renders de tablas.
 * 
 * @param {string} status - Estado (active|inactive|etc)
 * @param {Object} labels - Labels personalizados
 * @returns {string} HTML del badge
 */
export function formatStatusBadge(status, labels = {}) {
    const defaultLabels = {
        active: { text: "Activo", color: "#10B981" },
        inactive: { text: "Inactivo", color: "#6B7280" },
        pending: { text: "Pendiente", color: "#F59E0B" },
        ...labels
    };
    
    const config = defaultLabels[status] || { text: status, color: "#6B7280" };
    
    return `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; 
                        background: ${config.color}20; color: ${config.color}; 
                        font-size: 11px; font-weight: 600;">
                ${config.text}
            </span>`;
}
