import { createServer } from '../src/server';
import { initConfig, validateConfig } from '../src/config';

let server;

beforeAll(async () => {
  // Create the server and store the instance

  await initConfig();
  validateConfig();

  const app = createServer();
  await new Promise<void>((resolve) => {
    server = app.listen(3000, resolve);
  });
});

afterAll(() => {
  // Gracefully close the server after all tests are done
  return new Promise((resolve) => {
    server.close(resolve);
  });
});

export const serverUrl = 'http://localhost:3000';
