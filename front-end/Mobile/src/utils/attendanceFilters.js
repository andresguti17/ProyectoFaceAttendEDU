// ERF 5.1 / HU-HIST-001 AC9: filtros combinados del histórico (persona,
// rango de fechas inclusivo y estado). Las fechas son claves 'YYYY-MM-DD'.
export function filterAttendance(items = [], {search = '', from = '', to = '', status = ''} = {}) {
    const [start, end] = from && to && from > to ? [to, from] : [from, to];
    const needle = search.trim().toLowerCase();
    return items.filter((item) =>
        (!needle || String(item.nombre || '').toLowerCase().includes(needle)) &&
        (!start || item.fecha >= start) &&
        (!end || item.fecha <= end) &&
        (!status || item.estado === status)
    );
}
