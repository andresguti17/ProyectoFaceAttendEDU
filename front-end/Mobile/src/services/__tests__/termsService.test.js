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
  expect(resolveTermsGate({ enabled: false, minor: true, pendingStep: 'TERMS' }))
    .toEqual({ gate: TERMS_GATE.BLOCKED, step: 'TERMS', minor: true });
  expect(resolveTermsGate({ enabled: true, minor: true, pendingStep: 'NONE' }).gate).toBe(TERMS_GATE.NONE);
});

test('if identity does not answer the login is not blocked by the app', async () => {
  request.mockRejectedValueOnce(new Error('offline'));

  expect((await TermsService.gateFor('p-1')).gate).toBe(TERMS_GATE.NONE);
  expect((await TermsService.gateFor(null)).gate).toBe(TERMS_GATE.NONE);
});
