import Fastify from 'fastify';
import { academicPermission } from '../infrastructure/http/permissions';
import { toDateOnly, toIsoTimestamp } from '../infrastructure/db/database';
import { CreateEnrollmentUseCase } from '../application/use-cases/CreateEnrollmentUseCase';
import { Enrollment } from '../domain/entities/Enrollment';
import { AcademicActor } from '../domain/entities/AcademicActor';

describe('academic permissions', () => {
  it('reads need only a session; writes follow the RBAC matrix', () => {
    expect(academicPermission('GET', '/api/v1/schools')).toBeNull();
    expect(academicPermission('POST', '/api/v1/schools')).toBe('academic.school:manage');
    expect(academicPermission('PATCH', '/api/v1/enrollments/3/status')).toBe('academic.enrollment:manage');
    expect(academicPermission('GET', '/api/v1/quality/report')).toBe('configuration:manage');
  });
});

describe('database value normalisation', () => {
  it('keeps the stored wall clock of a timestamp and pads milliseconds', () => {
    expect(toIsoTimestamp('2026-10-23 14:05:09.12')).toBe('2026-10-23T14:05:09.120Z');
    expect(toIsoTimestamp('2026-10-23T14:05:09')).toBe('2026-10-23T14:05:09.000Z');
    expect(toIsoTimestamp('not a date')).toBe('not a date');
    expect(toIsoTimestamp(null)).toBeNull();
  });

  it('cuts dates to YYYY-MM-DD', () => {
    expect(toDateOnly('2026-10-23T00:00:00')).toBe('2026-10-23');
    expect(toDateOnly(undefined)).toBeNull();
  });
});

describe('enrollment domain', () => {
  it('the use case saves a new active enrollment for the actor and cohort', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const id = await new CreateEnrollmentUseCase({ save } as any).execute({ academicActorId: 7, cohortId: 3 });
    expect(id).toBe(0);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ academicActorId: 7, cohortId: 3, status: 'Active' }));
  });

  it('entities start without an id', () => {
    expect(Enrollment.create(1, 2)).toMatchObject({ enrollmentId: 0, status: 'Active' });
    expect(AcademicActor.create('p', 'STUDENT', 4)).toMatchObject({ academicActorId: 0, actorType: 'STUDENT', schoolId: 4 });
  });
});

describe('event publisher', () => {
  afterEach(() => {
    delete process.env.KAFKA_BROKERS;
    jest.resetModules();
  });

  it('without brokers it is a no-op that never breaks the request', async () => {
    const { publishEvent, registerEventHook } = await import('../infrastructure/messaging/event.publisher');
    await expect(publishEvent('academic-events', { a: 1 })).resolves.toBeUndefined();
    const app = Fastify();
    registerEventHook(app);
    app.post('/x', async (_req, reply) => reply.code(201).send({}));
    expect((await app.inject({ method: 'POST', url: '/x' })).statusCode).toBe(201);
    await app.close();
  });

  it('with brokers it publishes successful POSTs and connects once', async () => {
    process.env.KAFKA_BROKERS = 'kafka:9092';
    const send = jest.fn().mockResolvedValue(undefined);
    const connect = jest.fn().mockResolvedValue(undefined);
    jest.doMock('kafkajs', () => ({ Kafka: jest.fn(() => ({ producer: () => ({ connect, send }) })) }));
    const { registerEventHook } = await import('../infrastructure/messaging/event.publisher');
    const app = Fastify();
    registerEventHook(app);
    app.post('/api/v1/schools', async (_req, reply) => reply.code(201).send({}));
    app.post('/api/v1/bad', async (_req, reply) => reply.code(400).send({}));
    await app.inject({ method: 'POST', url: '/api/v1/schools' });
    await app.inject({ method: 'POST', url: '/api/v1/schools' });
    await app.inject({ method: 'POST', url: '/api/v1/bad' });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    const message = JSON.parse(send.mock.calls[0][0].messages[0].value);
    expect(send.mock.calls[0][0].topic).toBe('academic-events');
    expect(message).toMatchObject({ method: 'POST', url: '/api/v1/schools', status: 201 });
    await app.close();
  });
});
