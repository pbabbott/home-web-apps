import { Express } from 'express';

const startTime = Date.now();

export const configureMetricsRoute = (app: Express) => {
  app.get('/metrics', (_, res) => {
    const uptimeSeconds = (Date.now() - startTime) / 1000;

    const output =
      [
        '# HELP app_up Whether the service process is up and responding',
        '# TYPE app_up gauge',
        'app_up 1',
        '# HELP process_uptime_seconds Seconds since the process started',
        '# TYPE process_uptime_seconds gauge',
        `process_uptime_seconds ${uptimeSeconds}`,
      ].join('\n') + '\n';

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(output);
  });
};
