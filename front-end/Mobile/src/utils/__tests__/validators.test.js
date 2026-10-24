import { validateEmail } from '../validators';

describe('validateEmail', () => {
  it.each(['user@example.com', 'a.b+tag@sub.example.co', 'x@y.z'])('accepts %s', (email) => {
    expect(validateEmail(email)).toBe(true);
  });

  it.each(['', 'invalid', 'a@b', 'a@@b.com', 'a b@c.com', '@b.com', 'a@.com', 'a@b.', 'a@b..c'])(
    'rejects %p',
    (email) => {
      expect(validateEmail(email)).toBe(false);
    },
  );

  it('stays linear on a long adversarial domain', () => {
    const start = Date.now();
    expect(validateEmail(`a@${'.'.repeat(60000)} `)).toBe(false);
    expect(Date.now() - start).toBeLessThan(250);
  });
});
