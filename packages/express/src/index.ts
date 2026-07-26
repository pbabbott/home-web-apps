export { configureBaseServerMiddleware } from './middleware/base-server-middleware/base-server-middleware';
export { configureErrorHandler } from './middleware/error-handler/error-handler';
export { validateBody } from './middleware/validate-body/validate-body';
export { validateParams } from './middleware/validate-params/validate-params';
export { validateQuery } from './middleware/validate-query/validate-query';

export { configureHealthRoute } from './routes/health-route/health-route';

export type { ValidationError } from './lib/format-zod-error';
