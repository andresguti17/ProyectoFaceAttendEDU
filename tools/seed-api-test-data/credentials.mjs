// Seeded logins: usernames are public defaults, passwords are never hard-coded.
// Every password comes from the environment (.env, see .env.example) so no
// credential lives in the repository source.
export const REQUIRED_PASSWORD_VARS = [
  "SEED_PASSWORD",
  "INSTRUCTOR_PASSWORD",
  "STUDENT_PASSWORD",
  "TEACHER_PASSWORD",
  "SCHOOL_ADMIN_PASSWORD",
];

export function resolveSeedCredentials(env) {
  const missing = REQUIRED_PASSWORD_VARS.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required password variables: ${missing.join(", ")} (copy .env.example to .env)`);
  }
  return {
    adminUsername: env.SEED_USERNAME ?? "carolina.mendoza",
    adminPassword: env.SEED_PASSWORD,
    instructorUsername: env.INSTRUCTOR_USERNAME ?? "carlos.restrepo",
    instructorPassword: env.INSTRUCTOR_PASSWORD,
    studentUsername: env.STUDENT_USERNAME ?? "valentina.rios",
    studentPassword: env.STUDENT_PASSWORD,
    teacherPassword: env.TEACHER_PASSWORD,
    schoolAdminPassword: env.SCHOOL_ADMIN_PASSWORD,
  };
}
