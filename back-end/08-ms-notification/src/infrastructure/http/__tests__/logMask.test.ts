import { maskEmail } from '../logMask';

describe('maskEmail', () => {
  it('keeps the first letter and the domain of an address', () => {
    expect(maskEmail('ana.perez@example.com')).toBe('a***@example.com');
  });

  it('hides anything that is not an address', () => {
    expect(maskEmail('')).toBe('***');
    expect(maskEmail('no-at-sign')).toBe('***');
    expect(maskEmail('@example.com')).toBe('***');
    expect(maskEmail(undefined)).toBe('***');
    expect(maskEmail(['a@b.co'])).toBe('***');
  });
});
