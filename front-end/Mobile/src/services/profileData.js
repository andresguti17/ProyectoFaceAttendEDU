// Secciones del perfil con datos reales (Manual de Usuario, módulo 10): el
// aprendiz ve sus cursos, su asistencia y sus justificaciones; el instructor,
// su horario y la asistencia por curso. Cada sección falla por separado: si una
// consulta no responde, esa sección queda vacía (oculta) y el resto se muestra.
import { request, GET } from '../api/apiClient';
import { AttendanceService } from './AttendanceService';
import { JustificationService } from './JustificationService';
import { EnrollmentService } from './EnrollmentService';
import { CourseService } from './CourseService';
import { EnvironmentService } from './EnvironmentService';

const REPORT_MAX_IDS = 1000; // tope de classSessionIds en /attendance-reports

async function safely(load, fallback) {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

// Resuelve cada id una sola vez (varios bloques comparten curso o ambiente).
async function lookupNames(ids, getById, pickName) {
  const unique = [...new Set(ids.filter((id) => id != null))];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await safely(async () => pickName(await getById(id)), null)]),
  );
  return new Map(entries);
}

async function loadCourses(academicActorId) {
  const [enrollment] = await EnrollmentService.getActiveByActor(academicActorId);
  if (!enrollment?.cohortId) return [];
  const blocks = (await request({ method: GET, url: `api/v1/cohorts/${enrollment.cohortId}/blocks` })) ?? [];
  const courseIds = [...new Set(blocks.map((b) => b.courseId).filter((id) => id != null))];
  const courses = await Promise.all(courseIds.map((id) => safely(() => CourseService.getById(id), null)));
  return courses
    .filter(Boolean)
    .map((c) => ({ id_course: c.courseId, course_code: c.code, course_name: c.name }));
}

async function loadAttendanceStats(academicActorId) {
  const counts = (await AttendanceService.getSummary([academicActorId])).get(Number(academicActorId));
  if (!counts) return null;
  return { present: counts.present ?? 0, absent: counts.absent ?? 0, justified: counts.justified ?? 0 };
}

async function loadJustifications(academicActorId) {
  const list = await JustificationService.getByActor(academicActorId);
  return list
    .map((j) => ({
      id_justification: j.justificationId,
      date: j.submittedAt ? String(j.submittedAt).slice(0, 10) : null,
      reason: j.reason,
      approval: j.reviewStatus,
    }))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
}

export async function loadStudentProfileSections(academicActorId) {
  if (!academicActorId) return { courses: [], attendanceStats: null, justifications: [] };
  const [courses, attendanceStats, justifications] = await Promise.all([
    safely(() => loadCourses(academicActorId), []),
    safely(() => loadAttendanceStats(academicActorId), null),
    safely(() => loadJustifications(academicActorId), []),
  ]);
  return { courses, attendanceStats, justifications };
}

async function courseStats(courseId, courseName, blocks) {
  const sessions = (await Promise.all(
    blocks.map((b) => safely(() => request({ method: GET, url: `api/v1/blocks/${b.scheduleBlockId}/sessions` }), [])),
  )).flat();
  // shortcut: con más de REPORT_MAX_IDS sesiones solo se cuentan las primeras; paginar si llega a pasar.
  const ids = sessions.map((s) => s.classSessionId).filter((id) => id != null).slice(0, REPORT_MAX_IDS);
  if (ids.length === 0) return null;
  const report = await request({
    method: GET,
    url: 'api/v1/attendance-reports',
    params: { classSessionIds: ids.join(',') },
  });
  const totals = report?.totals ?? {};
  return {
    id_course: courseId,
    course_name: courseName,
    present: totals.present ?? 0,
    absent: totals.absent ?? 0,
    total: totals.total ?? 0,
  };
}

/**
 * @param {number} academicActorId actor académico del instructor
 * @param {(dayOfWeek: number) => string} dayLabel nombre del día en el idioma de la app (1 = lunes)
 */
export async function loadTeacherProfileSections(academicActorId, dayLabel) {
  if (!academicActorId) return { teacherSchedules: [], teacherCourseStats: [] };
  const blocks = await safely(
    async () => (await request({ method: GET, url: `api/v1/actors/${academicActorId}/blocks` })) ?? [],
    [],
  );
  if (blocks.length === 0) return { teacherSchedules: [], teacherCourseStats: [] };

  const [courseNames, environmentNames] = await Promise.all([
    lookupNames(blocks.map((b) => b.courseId), (id) => CourseService.getById(id), (c) => c?.name || null),
    lookupNames(blocks.map((b) => b.environmentId), (id) => EnvironmentService.getById(id), (e) => e?.name || null),
  ]);

  const teacherSchedules = [...blocks]
    .sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || String(a.startsAt).localeCompare(String(b.startsAt)))
    .map((b) => ({
      id_schedule: b.scheduleBlockId,
      day: dayLabel(b.dayOfWeek),
      start_time: b.startsAt ? String(b.startsAt).slice(0, 5) : null,
      end_time: b.endsAt ? String(b.endsAt).slice(0, 5) : null,
      course_name: courseNames.get(b.courseId) ?? null,
      classroom: environmentNames.get(b.environmentId) ?? null,
    }));

  const blocksByCourse = new Map();
  for (const b of blocks) {
    if (b.courseId == null) continue;
    blocksByCourse.set(b.courseId, [...(blocksByCourse.get(b.courseId) ?? []), b]);
  }
  const teacherCourseStats = (await Promise.all(
    [...blocksByCourse.entries()].map(([courseId, courseBlocks]) =>
      safely(() => courseStats(courseId, courseNames.get(courseId) ?? null, courseBlocks), null)),
  )).filter(Boolean);

  return { teacherSchedules, teacherCourseStats };
}
