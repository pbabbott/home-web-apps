import supertest from "supertest";
import { createServer } from "../../src/server";

describe("GET /healthz", () => {
  it("status check returns 200", async () => {
    await supertest(createServer())
      .get("/healthz")
      .expect(200)
      .then((res) => {
        expect(res.body.ok).toBe(true);
      });
  });
});
