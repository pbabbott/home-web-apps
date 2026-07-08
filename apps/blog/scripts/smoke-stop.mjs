import { existsSync, readFileSync, unlinkSync } from 'node:fs';

const pidFile = '.smoke.pid';

if (existsSync(pidFile)) {
  const pid = Number(readFileSync(pidFile, 'utf8'));
  try {
    process.kill(-pid);
  } catch {
    // already stopped
  }
  unlinkSync(pidFile);
}
