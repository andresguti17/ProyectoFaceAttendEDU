// El perfil muestra datos reales del aprendiz y del instructor (Manual de Usuario, módulo 10).
import { loadStudentProfileSections, loadTeacherProfileSections } from '../profileData';
import { request } from '../../api/apiClient';
import { AttendanceService } from '../AttendanceService';
import { JustificationService } from '../JustificationService';
import { EnrollmentService } from '../EnrollmentService';
import { CourseService } from '../CourseService';
import { EnvironmentService } from '../EnvironmentService';

jest.mock('../../api/apiClient', () => ({ request: jest.fn(), GET: 'GET' }));
jest.mock('../AttendanceService', () => ({ AttendanceService: { getSummary: jest.fn() } }));
jest.mock('../JustificationService', () => ({ JustificationService: { getByActor: jest.fn() } }));
jest.mock('../EnrollmentService', () => ({ EnrollmentService: { getActiveByActor: jest.fn() } }));
jest.mock('../CourseService', () => ({ CourseService: { getById: jest.fn() } }));
jest.mock('../EnvironmentService', () => ({ EnvironmentService: { getById: jest.fn() } }));

const COURSES = { 2: { courseId: 2, code: 'MAT-1', name: 'Matemáticas' }, 3: { courseId: 3, code: 'PRG-1', name: 'Programación' } };

beforeEach(() => {
  jest.resetAllMocks();
  CourseService.getById.mockImplementation(async (id) => COURSES[id]);
  EnvironmentService.getById.mockImplementation(async (id) => ({ environmentId: id, name: `Aula ${id}` }));
});

describe('loadStudentProfileSections', () => {
  test('arma cursos de su ficha, conteos de asistencia y justificaciones más recientes primero', async () => {
    EnrollmentService.getActiveByActor.mockResolvedValue([{ cohortId: 7 }]);
    request.mockImplementation(async ({ url }) => (url === 'api/v1/cohorts/7/blocks'
      ? [{ courseId: 2 }, { courseId: 3 }, { courseId: 2 }]
      : []));
    AttendanceService.getSummary.mockResolvedValue(new Map([[5, { present: 40, late: 3, absent: 4, justified: 1, total: 48 }]]));
    JustificationService.getByActor.mockResolvedValue([
      { justificationId: 1, submittedAt: '2026-09-01T10:00:00Z', reason: 'Cita médica', reviewStatus: 'Approved' },
      { justificationId: 2, submittedAt: '2026-10-02T10:00:00Z', reason: 'Calamidad', reviewStatus: 'Rejected' },
    ]);

    const sections = await loadStudentProfileSections(5);

    expect(sections.courses).toEqual([
      { id_course: 2, course_code: 'MAT-1', course_name: 'Matemáticas' },
      { id_course: 3, course_code: 'PRG-1', course_name: 'Programación' },
    ]);
    expect(sections.attendanceStats).toEqual({ present: 40, absent: 4, justified: 1 });
    expect(sections.justifications.map((j) => [j.date, j.approval])).toEqual([
      ['2026-10-02', 'Rejected'],
      ['2026-09-01', 'Approved'],
    ]);
  });

  test('si una consulta falla, esa sección queda vacía y las demás se cargan', async () => {
    EnrollmentService.getActiveByActor.mockRejectedValue(new Error('timeout'));
    AttendanceService.getSummary.mockResolvedValue(new Map());
    JustificationService.getByActor.mockResolvedValue([
      { justificationId: 3, submittedAt: null, reason: 'Sin fecha', reviewStatus: 'Pending' },
    ]);

    const sections = await loadStudentProfileSections(5);

    expect(sections.courses).toEqual([]);
    expect(sections.attendanceStats).toBeNull();
    expect(sections.justifications).toHaveLength(1);
  });

  test('sin actor académico no consulta nada', async () => {
    const sections = await loadStudentProfileSections(null);

    expect(sections).toEqual({ courses: [], attendanceStats: null, justifications: [] });
    expect(request).not.toHaveBeenCalled();
  });
});

describe('loadTeacherProfileSections', () => {
  const dayLabel = (day) => ['', 'Lunes', 'Martes'][day];

  test('ordena el horario por día y hora y agrega la asistencia por curso', async () => {
    request.mockImplementation(async ({ url, params }) => {
      if (url === 'api/v1/actors/9/blocks') {
        return [
          { scheduleBlockId: 2, courseId: 3, environmentId: 1, dayOfWeek: 1, startsAt: '10:00:00', endsAt: '12:00:00' },
          { scheduleBlockId: 1, courseId: 2, environmentId: 1, dayOfWeek: 1, startsAt: '08:00:00', endsAt: '10:00:00' },
          { scheduleBlockId: 3, courseId: 2, environmentId: 2, dayOfWeek: 2, startsAt: '08:00:00', endsAt: '10:00:00' },
        ];
      }
      if (url === 'api/v1/blocks/1/sessions') return [{ classSessionId: 11 }, { classSessionId: 12 }];
      if (url === 'api/v1/blocks/3/sessions') return [{ classSessionId: 31 }];
      if (url === 'api/v1/blocks/2/sessions') return [];
      if (url === 'api/v1/attendance-reports') {
        return { totals: { present: params.classSessionIds === '11,12,31' ? 50 : 0, absent: 6, total: 60 } };
      }
      return [];
    });

    const { teacherSchedules, teacherCourseStats } = await loadTeacherProfileSections(9, dayLabel);

    expect(teacherSchedules.map((s) => `${s.day} ${s.start_time}-${s.end_time} ${s.course_name} ${s.classroom}`)).toEqual([
      'Lunes 08:00-10:00 Matemáticas Aula 1',
      'Lunes 10:00-12:00 Programación Aula 1',
      'Martes 08:00-10:00 Matemáticas Aula 2',
    ]);
    // Programación no tiene sesiones: no aparece en las estadísticas.
    expect(teacherCourseStats).toEqual([
      { id_course: 2, course_name: 'Matemáticas', present: 50, absent: 6, total: 60 },
    ]);
  });

  test('sin bloques asignados devuelve secciones vacías', async () => {
    request.mockResolvedValue([]);

    const sections = await loadTeacherProfileSections(9, dayLabel);

    expect(sections).toEqual({ teacherSchedules: [], teacherCourseStats: [] });
  });
});
