import os from 'os';

export const workerId = `${os.hostname()}-${process.pid}`;
