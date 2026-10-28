/**
 * ISO/IEC 9001 quality audit of 07-ms-configuration (clauses 8.5.2 / 9.1): the hooks and report
 * endpoints shared by the Node services (back-end/shared/node-infra/quality.js).
 */
import { createQualityAudit } from '@faceattend/infra/quality';

export const { registerQualityMiddleware, registerQualityHealthEndpoint } = createQualityAudit('07-ms-configuration');
