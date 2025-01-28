import supertest from "supertest";
import { createServer } from "../../src/server";
import { PortsResult } from "../../src/controllers/status";
import * as gluetunApi from "../../src/api/gluetun/gluetun"; 
import * as qbittorrentApi from "../../src/api/qbittorrent";

jest.mock("../../src/api/gluetun/gluetun");
jest.mock("../../src/api/qbittorrent");

describe("GET /status", () => {
  it("status check returns 200", async () => {
    await supertest(createServer())
      .get("/status")
      .expect(200)
      .then((res) => {
        expect(res.body.result).toBeDefined();
      });
  });
});

describe("GET /status/ports (mocked api responses)", () => {
  let result: PortsResult = null;
  const expectedGluetunPort = '12345';
  const expectedQbitTorrentPort = '54321';

  beforeAll(async () => {
    // Mock the getForwardedPort function
    (gluetunApi.getForwardedPort as jest.Mock).mockResolvedValue({ port: expectedGluetunPort });
    (qbittorrentApi.login as jest.Mock).mockResolvedValue("token");
    (qbittorrentApi.getApplicationPreferences as jest.Mock).mockResolvedValue({ listen_port: expectedQbitTorrentPort });

    await supertest(createServer())
      .get("/status/ports")
      .expect(200)
      .then((res) => {
        result = res.body.result;
      });
  });

  it('should have a body', () => {
    expect(result).toBeDefined()
  })
  it("should have a gluetun port", async () => {
    expect(result.gluetunPort).toBe(expectedGluetunPort);
  });
  it("should have a qbitTorrent port", async () => {
    expect(result.qbitTorrentPort).toBe(expectedQbitTorrentPort);
  });
});

describe("GET /status/public-ip", () => {

})