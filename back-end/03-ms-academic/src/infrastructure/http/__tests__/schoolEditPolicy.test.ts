import { ownSchoolEdit } from '../schoolEditPolicy';

describe('ownSchoolEdit', () => {
  const current = { code: 'ICT-01' };

  it('lets a school admin change the name and contact data', () => {
    const result = ownSchoolEdit(current, { name: 'Nuevo nombre', phone: '300', address: 'Calle 1', email: 'a@b.co' });
    expect(result).toEqual({
      allowed: true,
      changes: { name: 'Nuevo nombre', phone: '300', address: 'Calle 1', email: 'a@b.co' },
    });
  });

  it('accepts the unchanged code the web form always sends back, without writing it', () => {
    const result = ownSchoolEdit(current, { code: 'ICT-01', name: 'X' });
    expect(result).toEqual({ allowed: true, changes: { name: 'X' } });
  });

  it('refuses a different code, the active flag and the city catalog id', () => {
    expect(ownSchoolEdit(current, { code: 'OTHER' }).allowed).toBe(false);
    expect(ownSchoolEdit(current, { status: false }).allowed).toBe(false);
    expect(ownSchoolEdit(current, { cityId: 5 }).allowed).toBe(false);
  });
});
