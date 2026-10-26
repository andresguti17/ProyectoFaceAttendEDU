import { z } from 'zod';

/**
 * Every field optional and without its create-time default: since zod 4,
 * `.partial()` still fills absent fields with `.default()` values, so a PUT
 * that sends one field would silently reset the others (status back to Draft).
 */
export function patchSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      z.optional(field instanceof z.ZodDefault ? field.unwrap() : field),
    ]),
  );
  return z.object(shape) as unknown as ReturnType<z.ZodObject<T>['partial']>;
}
