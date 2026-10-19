import { getHighestRole, normalizeBackendRole } from '../getHighestRole';

// Regresión: la cuenta "Super Administrador" (007-split-super-admin-role,
// con espacio) resolvía null y el login la rechazaba como rol no válido.
describe('getHighestRole', () => {
  it.each([
    ['Super Administrador', 'Administrador'],
    ['SUPER_ADMINISTRADOR', 'Administrador'],
    ['SUPER_ADMIN', 'Administrador'],
    ['Administrador', 'Administrador'],
    ['ADMINISTRADOR', 'Administrador'],
    ['Instructor', 'Instructor'],
    ['Aprendiz', 'Aprendiz'],
  ])('maps %p to %p', (input, expected) => {
    expect(normalizeBackendRole(input)).toBe(expected);
    expect(getHighestRole([input])).toBe(expected);
  });

  it('returns null for empty or unknown roles', () => {
    expect(getHighestRole([])).toBeNull();
    expect(getHighestRole(null)).toBeNull();
    expect(getHighestRole(['RolInventado'])).toBeNull();
  });

  it('keeps admin priority over lower roles', () => {
    expect(getHighestRole(['Aprendiz', 'Super Administrador'])).toBe('Administrador');
  });
});
