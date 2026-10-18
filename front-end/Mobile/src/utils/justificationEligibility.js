// HU-JUS-001 AC1/AC5: solo se justifican inasistencias o retardos que aún no
// tienen justificación (relación 1:1 registro–justificación).
const JUSTIFIABLE_STATUSES = ['Absent', 'Late'];

export function eligibleRecords(records = [], justifications = []) {
    const justified = new Set(justifications.map((j) => String(j.attendanceRecordId)));
    return records
        .filter((r) => JUSTIFIABLE_STATUSES.includes(r.attendance_status))
        .filter((r) => !justified.has(String(r.attendance_record_id)));
}

// Una inasistencia no tiene captured_at (nadie marcó): su fecha es la de la sesión de clase.
export const recordDate = (record) => String(record.session_date || record.captured_at || '').slice(0, 10);

export const byRecordDateDesc = (a, b) => recordDate(b).localeCompare(recordDate(a));
