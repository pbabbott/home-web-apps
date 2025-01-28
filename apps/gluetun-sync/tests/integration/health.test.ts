import supertest from "supertest";

describe("GET /healthz", () => {
  it("status check returns 200", async () => {
    await supertest('http://localhost:3000')
      .get("/healthz")
      .expect(200)
      .then((res) => {
        expect(res.body.ok).toBe(true);
      });
  });
});
