// ============================================================
//  FaceAttend EDU — useHistoricosViewModel
//
//  ViewModel para la gestión de históricos de asistencia.
//  Maneja la exportación de datos históricos a Excel y PDF.
// ============================================================

import { useCallback } from "react";
import { useTheme } from "../view/components/hooks/useTheme";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { exportToExcel, exportToPDF, buildHTMLTable, formatPercentageWithColor, formatStatusBadge } from "../core/utils/exportHelpers";
import { useDateFormat } from "../view/components/hooks/useDateFormat";

/**
 * Hook para manejar la lógica de exportación de históricos
 */
export function useHistoricosViewModel(filteredUsers) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const { formatDate } = useDateFormat();
    const c = theme.colors;

    /**
     * Construye las filas de datos para Excel
     */
    const buildExcelRows = useCallback((users) => {
        return users.map(user => ({
            [t("Código")]: user.studentCode,
            [t("Nombre")]: user.studentName,
            [t("Ficha")]: user.fichaName || user.ficha,
            [t("Ambiente")]: user.environment,
            [t("Fecha")]: user.date ? formatDate(user.date, "DD/MM/YYYY") : t("Sin registro"),
            [t("Estado")]: user.late ? t("Retardo") : (user.status === "present" ? t("Presente") : t("Ausente")),
            [t("Horario Programado")]: user.scheduledStartTime && user.scheduledEndTime 
                ? `${user.scheduledStartTime} - ${user.scheduledEndTime}` 
                : t("N/A"),
            [t("Registro Real")]: user.actualCheckInTime && user.actualCheckOutTime 
                ? `${user.actualCheckInTime} - ${user.actualCheckOutTime}` 
                : t("N/A"),
            [t("Total de Registros")]: user.totalRecords,
            [t("Asistencia (%)")]: user.attendance || 0,
        }));
    }, [t, formatDate]);

    /**
     * Exporta los datos históricos a Excel
     */
    const exportExcel = useCallback(() => {
        const rows = buildExcelRows(filteredUsers);

        // Configurar hojas con anchos de columna
        const sheets = [
            {
                name: t("Históricos de Asistencia"),
                data: rows,
                columns: [
                    { wch: 12 },  // Código
                    { wch: 32 },  // Nombre
                    { wch: 16 },  // Ficha
                    { wch: 14 },  // Ambiente
                    { wch: 14 },  // Fecha
                    { wch: 12 },  // Estado
                    { wch: 20 },  // Horario Programado
                    { wch: 20 },  // Registro Real
                    { wch: 14 },  // Total Registros
                    { wch: 14 },  // Asistencia (%)
                ],
            },
        ];

        const filename = `Historicos_Asistencia_${formatDate(new Date(), "YYYY-MM-DD")}.xlsx`;
        const result = exportToExcel(sheets, filename);

        if (!result.success) {
            console.error("Error al exportar Excel:", result.error);
        }

        return result;
    }, [filteredUsers, buildExcelRows, t, formatDate]);

    /**
     * Exporta los datos históricos a PDF
     */
    const exportPDF = useCallback(() => {
        // Construir tabla de históricos
        const historicosTable = buildHTMLTable(filteredUsers, [
            { key: "studentCode", label: t("Código"), width: "10%" },
            { key: "studentName", label: t("Nombre"), width: "20%" },
            { key: "fichaName", label: t("Ficha"), width: "12%" },
            { key: "environment", label: t("Ambiente"), width: "10%" },
            { 
                key: "date", 
                label: t("Fecha"), 
                width: "12%",
                render: (value) => value ? formatDate(value, "DD/MM/YYYY") : t("Sin registro")
            },
            {
                key: "status",
                label: t("Estado"),
                width: "10%",
                align: "center",
                render: (value, row) => {
                    const status = row.late ? "late" : (value === "present" ? "present" : "absent");
                    return formatStatusBadge(status, {
                        present: { text: t("Presente"), color: c.status.success },
                        late: { text: t("Retardo"), color: c.status.warning },
                        absent: { text: t("Ausente"), color: c.status.danger },
                    });
                },
            },
            {
                key: "attendance",
                label: t("Asistencia"),
                width: "10%",
                align: "center",
                render: (value) => formatPercentageWithColor(value || 0, 75, 60),
            },
        ]);

        // Construir HTML del reporte
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${t("Históricos de Asistencia")}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            padding: 40px;
            background: #ffffff;
            color: #1a1a1a;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid ${c.primary};
        }
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            color: ${c.primary};
            margin-bottom: 8px;
        }
        .header p {
            font-size: 14px;
            color: #666;
            margin-top: 4px;
        }
        .summary {
            display: flex;
            justify-content: space-around;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .summary-item {
            text-align: center;
        }
        .summary-item .value {
            font-size: 36px;
            font-weight: 700;
            color: ${c.primary};
            margin-bottom: 4px;
        }
        .summary-item .label {
            font-size: 14px;
            color: #666;
            font-weight: 500;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        thead {
            background: ${c.primary};
            color: white;
        }
        th {
            padding: 14px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 13px;
        }
        tbody tr:hover {
            background-color: #f8f9fa;
        }
        tbody tr:last-child td {
            border-bottom: none;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        @media print {
            body {
                padding: 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .summary-item .value {
                font-size: 28px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${t("Históricos de Asistencia")}</h1>
        <p>${t("Historial completo de registros de asistencia")}</p>
        <p>${t("Fecha de generación")}: ${formatDate(new Date(), "DD/MM/YYYY HH:mm")}</p>
    </div>

    <div class="summary">
        <div class="summary-item">
            <div class="value">${filteredUsers.length}</div>
            <div class="label">${filteredUsers.length === 1 ? t("Registro") : t("Registros")}</div>
        </div>
        <div class="summary-item">
            <div class="value">${new Set(filteredUsers.map(u => u.id)).size}</div>
            <div class="label">${t("Usuarios únicos")}</div>
        </div>
        <div class="summary-item">
            <div class="value">${filteredUsers.reduce((sum, u) => sum + u.totalRecords, 0)}</div>
            <div class="label">${t("Total de asistencias")}</div>
        </div>
    </div>

    ${historicosTable}

    <div class="footer">
        <p>FaceAttend EDU © ${new Date().getFullYear()}</p>
        <p>${t("Sistema de Control de Asistencia")}</p>
    </div>
</body>
</html>
        `;

        const result = exportToPDF(html, `Historicos_${formatDate(new Date(), "YYYY-MM-DD")}`);

        if (!result.success) {
            console.warn("Error al exportar PDF:", result.error);
        }

        return result;
    }, [filteredUsers, t, formatDate, c]);

    return {
        exportExcel,
        exportPDF,
    };
}
