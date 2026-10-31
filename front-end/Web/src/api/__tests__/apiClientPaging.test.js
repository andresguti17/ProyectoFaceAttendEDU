// fetchAllPages no debe cortar una lista sin decirlo (C-06): con el total conocido baja todo; sin total o
// por encima del tope absoluto corta, avisa por consola y marca el arreglo con `truncated`.
process.env.EXPO_PUBLIC_SESSION_MODE = 'bearer';
import { fetchAllPages } from '../apiClient';

const reply = (body) => ({ status: 200, ok: true, text: async () => JSON.stringify(body) });
const rows = (from, n) => Array.from({ length: n }, (_, i) => ({ id: from + i }));

beforeEach(() => {
    global.sessionStorage.clear();
    global.fetch = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/** Servidor falso paginado por { page, limit } con envelope { data, meta.total }. */
function envelopeServer(total) {
    global.fetch.mockImplementation(async (url) => {
        const q = new URL(url).searchParams;
        const page = Number(q.get('page'));
        const limit = Number(q.get('limit'));
        const from = (page - 1) * limit;
        return reply({ data: rows(from, Math.max(0, Math.min(limit, total - from))), meta: { page, limit, total } });
    });
}

describe('fetchAllPages', () => {
    it('baja una lista pequeña completa, sin marcarla ni avisar', async () => {
        envelopeServer(250);
        const out = await fetchAllPages('/api/v1/persons', {}, { by: 'page' });
        expect(out).toHaveLength(250);
        expect(out.truncated).toBeUndefined();
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('con el total conocido baja todas las filas aunque pasen de las 5.000 del tope por defecto', async () => {
        envelopeServer(7000);
        const out = await fetchAllPages('/api/v1/persons', {}, { by: 'page' });
        expect(out).toHaveLength(7000);
        expect(new Set(out.map((r) => r.id)).size).toBe(7000);
        expect(out.truncated).toBeUndefined();
    });

    it('si el total supera el tope absoluto corta, lo avisa y marca el arreglo', async () => {
        envelopeServer(2000);
        const out = await fetchAllPages('/api/v1/persons', {}, { by: 'page', hardMaxPages: 5 });
        expect(out).toHaveLength(500);
        expect(out.truncated).toBe(true);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(String(console.warn.mock.calls[0][0])).toContain('/api/v1/persons');
    });

    it('sin total, una lista que no termina se corta en maxPages, lo avisa y marca el arreglo', async () => {
        global.fetch.mockImplementation(async (url) => {
            const q = new URL(url).searchParams;
            return reply(rows(Number(q.get('offset')), Number(q.get('limit')))); // siempre una página llena
        });
        const out = await fetchAllPages('/api/v1/enrollments', {}, { by: 'offset', maxPages: 4 });
        expect(out).toHaveLength(400);
        expect(out.truncated).toBe(true);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('sin total, una lista que termina antes del tope no se marca', async () => {
        global.fetch.mockImplementation(async (url) => {
            const q = new URL(url).searchParams;
            const offset = Number(q.get('offset'));
            return reply(rows(offset, Math.max(0, Math.min(Number(q.get('limit')), 350 - offset))));
        });
        const out = await fetchAllPages('/api/v1/enrollments', {}, { by: 'offset', maxPages: 10 });
        expect(out).toHaveLength(350);
        expect(out.truncated).toBeUndefined();
        expect(console.warn).not.toHaveBeenCalled();
    });
});
