import { pgSchema, smallserial, bigserial, bigint, smallint, varchar, timestamp, uuid } from 'drizzle-orm/pg-core';

export const notificationSchema = pgSchema('notification');

const audit = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedBy: uuid('deleted_by'),
  rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
};

export const alertType = notificationSchema.table('alert_type', {
  alertTypeId: smallserial('alert_type_id').primaryKey(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  severity: varchar('severity', { length: 50 }).notNull().default('INFO'),
  channel: varchar('channel', { length: 50 }).notNull().default('IN_APP'),
  ...audit,
});

export const alert = notificationSchema.table('alert', {
  alertId: bigserial('alert_id', { mode: 'number' }).primaryKey(),
  academicActorId: bigint('academic_actor_id', { mode: 'number' }).notNull(),
  alertTypeId: smallint('alert_type_id').notNull().references(() => alertType.alertTypeId),
  raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  ...audit,
});

// No audit columns: a device token is either active or revoked (revoked_at).
export const deviceToken = notificationSchema.table('device_token', {
  deviceTokenId: bigserial('device_token_id', { mode: 'number' }).primaryKey(),
  academicActorId: bigint('academic_actor_id', { mode: 'number' }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique('uq_device_token_token'),
  platform: varchar('platform', { length: 10 }).notNull(),
  locale: varchar('locale', { length: 5 }).notNull().default('es'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
