/**
 * An address identifies a person: the logs carry it masked ("ana.perez@example.com" becomes
 * "a***@example.com"), the same shape identity uses. Anything that is not an address is "***".
 */
export function maskEmail(address: unknown): string {
  if (typeof address !== 'string') return '***';
  const at = address.indexOf('@');
  if (at <= 0) return '***';
  return `${address[0]}***${address.slice(at)}`;
}
