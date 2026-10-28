import { request } from '../../api/apiClient';
import { TERMS_GATE, TERMS_VERSION, TermsService, resolveTermsGate } from '../termsService';

jest.mock('../../api/apiClient', () => ({ request: jest.fn(), GET: 'GET', POST: 'POST' }));

beforeEach(() => request.mockReset());

test('accepting sends the terms version in force', async () => {
  request.mockResolvedValueOnce({});

  await TermsService.accept('p-1');

  expect(request).toHaveBeenCalledWith({
    method: 'POST',
    url: 'api/v1/persons/p-1/terms',
    data: { termsVersion: TERMS_VERSION },
  });
});

test('an adult pending the terms must sign; a minor is blocked on the missing step', () => {
  expect(resolveTermsGate({ enabled: false, minor: false, pendingStep: 'TERMS' }))
    .toEqual({ gate: TERMS_GATE.ACCEPT, step: 'TERMS', minor: false });
  expect(resolveTermsGate({ enabled: false, minor: true, pendingStep: 'GUARDIAN' }))
    .toEqual({ gate: TERMS_GATE.BLOCKED, step: 'GUARDIAN', minor: true });
  expect(resolveTermsGate({ enabled: false, minor: true, pendingStep: 'DOCUMENT' }))
    .toEqual({ gate: TERMS_GATE.BLOCKED, step: 'DOCUMENT', minor: true });
  expect(resolveTermsGate({ enabled: false, minor: true, pendingStep: 'TERMS' }))
    .toEqual({ gate: TERMS_GATE.BLOCKED, step: 'TERMS', minor: true });
  expect(resolveTermsGate({ enabled: true, minor: true, pendingStep: 'NONE' }).gate).toBe(TERMS_GATE.NONE);
});

// Antes fallaba abierto (NONE) y la persona entraba sin ver el aviso: un vacío legal.
test('if the terms status cannot be verified the gate fails closed', async () => {
  request.mockRejectedValueOnce(new Error('offline'));
  await expect(TermsService.gateFor('p-1')).rejects.toMatchObject({ code: 'TERMS_UNAVAILABLE' });

  await expect(TermsService.gateFor(null)).rejects.toMatchObject({ code: 'TERMS_UNAVAILABLE' });

  request.mockResolvedValueOnce({});
  await expect(TermsService.gateFor('p-1')).rejects.toMatchObject({ code: 'TERMS_UNAVAILABLE' });
});

test('a reachable identity decides the gate', async () => {
  request.mockResolvedValueOnce({ enabled: false, minor: false, pendingStep: 'TERMS' });
  expect((await TermsService.gateFor('p-1')).gate).toBe(TERMS_GATE.ACCEPT);

  request.mockResolvedValueOnce({ enabled: true, minor: false, pendingStep: 'NONE' });
  expect((await TermsService.gateFor('p-1')).gate).toBe(TERMS_GATE.NONE);
});
