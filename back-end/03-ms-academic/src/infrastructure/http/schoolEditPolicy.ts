/**
 * What a school Administrador may change on its OWN school. Contact data and the
 * display name are theirs; the code, the active flag and the city-catalog id are
 * platform-level and stay with Super Administrador.
 *
 * The web form always sends the current `code` back, so an unchanged `code` is
 * accepted — only an actual change is refused.
 */
export interface SchoolPatch {
  code?: string;
  status?: boolean;
  cityId?: number;
  [field: string]: unknown;
}

export type OwnSchoolEdit =
  | { allowed: true; changes: Record<string, unknown> }
  | { allowed: false; reason: string };

export function ownSchoolEdit(current: { code: string }, patch: SchoolPatch): OwnSchoolEdit {
  const { code, status, cityId, ...changes } = patch;
  if (code !== undefined && code !== current.code) {
    return { allowed: false, reason: 'Only Super Administrador changes the school code' };
  }
  if (status !== undefined) {
    return { allowed: false, reason: 'Only Super Administrador activates or deactivates a school' };
  }
  if (cityId !== undefined) {
    return { allowed: false, reason: 'Only Super Administrador changes the school city catalog id' };
  }
  return { allowed: true, changes };
}
