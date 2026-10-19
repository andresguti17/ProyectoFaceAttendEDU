import BaseModel from '../BaseModel';
import i18n from '../../utils/i18n';

export default class ScheduleBlock extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.scheduleBlockId = data.schedule_block_id || null;
    this.cohortId = data.cohort_id || null;
    this.courseId = data.course_id || null;
    this.environmentId = data.environment_id || null;
    this.instructorActorId = data.instructor_actor_id || null;
    this.dayOfWeek = data.day_of_week || null;
    this.startsAt = data.starts_at || null;
    this.endsAt = data.ends_at || null;
  }

  get dayName() {
    return this.dayNameForLocale('es-ES');
  }

  dayNameForLocale(locale = 'es-ES') {
    const day = Number(this.dayOfWeek);
    if (!day || day < 1 || day > 7) return '';
    try {
      // 2024-01-01 fue lunes; desplazar para obtener el día de la semana.
      const ref = new Date(2024, 0, day);
      const label = ref.toLocaleDateString(locale, {weekday: 'long'});
      return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
    } catch {
      return i18n.t(`weekdays.${day}`);
    }
  }

  static fromApi(data) {
    if (!data) return null;
    return new ScheduleBlock(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      schedule_block_id: this.scheduleBlockId,
      cohort_id: this.cohortId,
      course_id: this.courseId,
      environment_id: this.environmentId,
      instructor_actor_id: this.instructorActorId,
      day_of_week: this.dayOfWeek,
      starts_at: this.startsAt,
      ends_at: this.endsAt,
    };
  }
}
