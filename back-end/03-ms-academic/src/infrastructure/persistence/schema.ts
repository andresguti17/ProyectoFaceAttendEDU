import { pgTable, serial, smallserial, bigserial, integer, bigint, smallint, varchar, boolean, date, timestamp } from 'drizzle-orm/pg-core';

// Canonical Drizzle schema — 8 tables from fae-docs/06-data/domains/03-academic.md (schema academic).
// Runtime CRUD uses memory.store.ts; this file keeps DB mapping for Liquibase/Drizzle parity.
const audit = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
  rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
};

export const school = pgTable('school', {
  schoolId: serial('school_id').primaryKey(),
  code: varchar('code').notNull().unique(),
  name: varchar('name').notNull(),
  cityId: integer('city_id').notNull(),
  address: varchar('address'),
  phone: varchar('phone'),
  email: varchar('email'),
  status: boolean('status').notNull().default(true),
  ...audit,
});

export const program = pgTable('program', {
  programId: serial('program_id').primaryKey(),
  schoolId: integer('school_id').notNull(),
  code: varchar('code').notNull(),
  name: varchar('name').notNull(),
  status: boolean('status').notNull().default(true),
  ...audit,
});

export const academicPeriod = pgTable('academic_period', {
  academicPeriodId: serial('academic_period_id').primaryKey(),
  schoolId: integer('school_id').notNull(),
  name: varchar('name').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  ...audit,
});

export const cohort = pgTable('cohort', {
  cohortId: bigserial('cohort_id', { mode: 'number' }).primaryKey(),
  programId: integer('program_id').notNull(),
  academicPeriodId: integer('academic_period_id').notNull(),
  code: varchar('code').notNull().unique(),
  status: boolean('status').notNull().default(true),
  ...audit,
});

export const course = pgTable('course', {
  courseId: serial('course_id').primaryKey(),
  programId: integer('program_id').notNull(),
  code: varchar('code').notNull(),
  name: varchar('name').notNull(),
  creditHours: smallint('credit_hours').notNull(),
  status: boolean('status').notNull().default(true),
  ...audit,
});

export const academicActorType = pgTable('academic_actor_type', {
  actorTypeId: smallint('actor_type_id').primaryKey(),
  code: varchar('code').notNull().unique(),
  name: varchar('name').notNull(),
  ...audit,
});

export const academicActor = pgTable('academic_actor', {
  academicActorId: bigserial('academic_actor_id', { mode: 'number' }).primaryKey(),
  personId: varchar('person_id').notNull(),
  actorTypeId: smallint('actor_type_id').notNull(),
  schoolId: integer('school_id').notNull(),
  actorCode: varchar('actor_code').notNull(),
  startedOn: date('started_on').notNull(),
  endedOn: date('ended_on'),
  status: boolean('status').notNull().default(true),
  ...audit,
});

export const enrollment = pgTable('enrollment', {
  enrollmentId: bigserial('enrollment_id', { mode: 'number' }).primaryKey(),
  academicActorId: bigint('academic_actor_id', { mode: 'number' }).notNull(),
  cohortId: bigint('cohort_id', { mode: 'number' }).notNull(),
  enrolledOn: date('enrolled_on').notNull(),
  enrollmentStatus: varchar('enrollment_status').notNull().default('Active'),
  ...audit,
});
