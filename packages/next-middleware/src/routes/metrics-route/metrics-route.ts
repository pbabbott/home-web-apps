import { NextResponse } from 'next/server';

const startTime = Date.now();

export const metricsRoute = async () => {
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

  return new NextResponse(output, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
};
