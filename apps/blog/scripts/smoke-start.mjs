import { spawn } from 'node:child_process';
import { cpSync, writeFileSync } from 'node:fs';

const port = process.env.PORT ?? '4020';
const pidFile = '.smoke.pid';

// `output: 'standalone'` means `next start` can't serve the app correctly —
// the real production entrypoint (also used by the Docker image) is the
// bundled server.js, which expects static assets copied alongside it.
const standaloneDir = '.next/standalone/apps/blog';
cpSync('.next/static', `${standaloneDir}/.next/static`, { recursive: true });
cpSync('public', `${standaloneDir}/public`, { recursive: true });

const child = spawn('node', ['server.js'], {
  cwd: standaloneDir,
  detached: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: port,
    HOSTNAME: '0.0.0.0',
  },
});
child.unref();
writeFileSync(pidFile, String(child.pid));

const url = `http://localhost:${port}/api/healthz`;
const deadline = Date.now() + 30_000;

while (Date.now() < deadline) {
  try {
    const res = await fetch(url);
    if (res.ok) {
      process.exit(0);
    }
  } catch {
    // server not ready yet
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

console.error(`blog server did not become ready on port ${port}`);
try {
  process.kill(-child.pid);
} catch {
  // already stopped
}
process.exit(1);
