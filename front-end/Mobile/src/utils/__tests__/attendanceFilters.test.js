// ERF 5.1 / HU-HIST-001 AC9: los filtros se aplican a la vez.
import { filterAttendance } from '../attendanceFilters';

const items = [
  { id: 1, nombre: 'Ana Pérez', fecha: '2026-10-01', estado: 'presente' },
  { id: 2, nombre: 'Luis Gómez', fecha: '2026-10-03', estado: 'tarde' },
  { id: 3, nombre: 'Ana Ruiz', fecha: '2026-10-05', estado: 'ausente' },
  { id: 4, nombre: 'Ana Pérez', fecha: '2026-10-07', estado: 'ausente' },
];
const ids = (list) => list.map((i) => i.id);

describe('filterAttendance', () => {
  test('sin filtros devuelve todo', () => {
    expect(ids(filterAttendance(items))).toEqual([1, 2, 3, 4]);
  });

  test('rango de fechas inclusivo', () => {
    expect(ids(filterAttendance(items, { from: '2026-10-03', to: '2026-10-05' }))).toEqual([2, 3]);
  });

  test('rango invertido se interpreta en orden', () => {
    expect(ids(filterAttendance(items, { from: '2026-10-05', to: '2026-10-03' }))).toEqual([2, 3]);
  });

  test('solo desde o solo hasta', () => {
    expect(ids(filterAttendance(items, { from: '2026-10-05' }))).toEqual([3, 4]);
    expect(ids(filterAttendance(items, { to: '2026-10-01' }))).toEqual([1]);
  });

  test('combina persona, rango y estado', () => {
    expect(ids(filterAttendance(items, { search: ' ana ', from: '2026-10-02', status: 'ausente' }))).toEqual([3, 4]);
  });
});
