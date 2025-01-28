import { createServer } from "../src/server";

let server;

beforeAll(async () => {
  // Create the server and store the instance
  const app = createServer();
  await new Promise<void>((resolve) => {
    server = app.listen(3000, resolve)
  });
});

afterAll(() => {
  // Gracefully close the server after all tests are done
  return new Promise((resolve) => {
    server.close(resolve);
  });
});
