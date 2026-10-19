import type { FastifyInstance } from 'fastify';
import { Kafka } from 'kafkajs';

const brokers = (process.env.KAFKA_BROKERS || '').split(',').map((s) => s.trim()).filter(Boolean);

let producer: ReturnType<Kafka['producer']> | null = null;
let connectAttempt: Promise<void> | null = null;

function getProducer(): ReturnType<Kafka['producer']> | null {
  if (brokers.length === 0) return null;
  if (!producer) {
    const kafka = new Kafka({ clientId: 'academic-service', brokers });
    producer = kafka.producer();
  }
  return producer;
}

export async function publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const p = getProducer();
    if (!p) return;
    if (!connectAttempt) {
      connectAttempt = p.connect().catch(() => undefined);
    }
    await connectAttempt;
    await p.send({ topic, messages: [{ value: JSON.stringify(payload) }] }).catch(() => undefined);
  } catch {
    // best-effort: never break the request path
  }
}

export function registerEventHook(app: FastifyInstance) {
  app.addHook('onResponse', async (req, reply) => {
    try {
      if (req.method === 'POST' && reply.statusCode >= 200 && reply.statusCode < 300) {
        await publishEvent('academic-events', { method: req.method, url: req.url, status: reply.statusCode });
      }
    } catch {
      // ignore
    }
  });
}
