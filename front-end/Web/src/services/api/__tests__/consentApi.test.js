// Ley 1581: la aceptación viaja con la versión vigente del aviso y la revocación
// biométrica suprime primero las plantillas y luego registra la revocación.
jest.mock("../../../api/apiClient", () => ({ request: jest.fn(async () => ({})) }));

import { request } from "../../../api/apiClient";
import { consentApi, consentBody } from "../consentApi";
import { PRIVACY_POLICY_VERSION } from "../../../core/config/privacy";

beforeEach(() => request.mockClear());

test("accept sends the notice in force and the optional biometric choice", async () => {
    await consentApi.accept("p-1", { biometricAccepted: true });

    const [url, opts] = request.mock.calls[0];
    expect(url).toContain("/persons/p-1/consent");
    expect(opts).toEqual({ method: "POST", body: { policyVersion: PRIVACY_POLICY_VERSION, biometricAccepted: true } });
});

test("biometric authorization defaults to not given", () => {
    expect(consentBody()).toEqual({ policyVersion: PRIVACY_POLICY_VERSION, biometricAccepted: false });
});

test("revoking deletes the biometric templates before recording the revocation", async () => {
    await consentApi.revokeBiometric("p-1");

    expect(request.mock.calls.map(([url, opts]) => `${opts.method} ${url}`)).toEqual([
        expect.stringMatching(/^DELETE .*\/biometric\/persons\/p-1$/),
        expect.stringMatching(/^DELETE .*\/persons\/p-1\/consent\/biometric$/),
    ]);
});
