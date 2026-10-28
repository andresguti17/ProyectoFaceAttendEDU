// Los términos viajan con la versión vigente; el acudiente solo con los campos del acudiente.
jest.mock("../../../api/apiClient", () => ({ request: jest.fn(async () => ({})) }));

import { request } from "../../../api/apiClient";
import { termsApi, guardianApi } from "../termsApi";
import { TERMS_VERSION } from "../../../core/config/terms";

beforeEach(() => request.mockClear());

test("reading the enablement is a GET on the person terms", async () => {
    await termsApi.get("p-1");

    const [url, opts] = request.mock.calls[0];
    expect(url).toContain("/persons/p-1/terms");
    expect(opts).toEqual({ method: "GET" });
});

test("accepting sends the terms version in force", async () => {
    await termsApi.accept("p-1");

    const [url, opts] = request.mock.calls[0];
    expect(url).toContain("/persons/p-1/terms");
    expect(opts).toEqual({ method: "POST", body: { termsVersion: TERMS_VERSION } });
});

test("registering a guardian trims the data and turns blank contact fields into null", async () => {
    await guardianApi.register("minor-1", {
        fullName: "  Ana Gómez ",
        documentType: "CC",
        documentNumber: " 5005 ",
        email: " ",
        phone: "3001234567",
        relationship: "Madre",
        extra: "not sent",
    });

    const [url, opts] = request.mock.calls[0];
    expect(url).toContain("/persons/minor-1/guardian");
    expect(opts).toEqual({
        method: "POST",
        body: {
            fullName: "Ana Gómez",
            documentType: "CC",
            documentNumber: "5005",
            email: null,
            phone: "3001234567",
            relationship: "Madre",
        },
    });
});

test("editing a guardian is a PUT on the same resource", async () => {
    await guardianApi.update("minor-1", { fullName: "Ana", documentType: "CC", documentNumber: "1", relationship: "Madre", phone: "3" });

    expect(request.mock.calls[0][1].method).toBe("PUT");
    expect(request.mock.calls[0][0]).toContain("/persons/minor-1/guardian");
});

test("the signed authorization goes as multipart to the guardian document of the minor", async () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });

    await guardianApi.uploadDocument("minor-1", blob, "autorizacion.pdf");

    const [url, opts] = request.mock.calls[0];
    expect(url).toContain("/persons/minor-1/guardian/document");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get("file").name).toBe("autorizacion.pdf");
});
