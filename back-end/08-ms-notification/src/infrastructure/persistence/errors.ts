/**
 * Persistence error model of 08-ms-notification: the one shared by the Node services
 * (back-end/shared/node-infra/errors.js). Driver failures become RepositoryErrors
 * with an HTTP status and never carry the driver's own detail to the client.
 */
export * from '@faceattend/infra/errors';
