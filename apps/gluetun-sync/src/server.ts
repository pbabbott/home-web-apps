import { json, urlencoded } from "body-parser";
import express, { type Express } from "express";
import morgan from "morgan";
import cors from "cors";
import { config } from "./config";
import { sync } from "./controllers/sync";

export const createServer = (): Express => {
  const app = express();
  app
    .disable("x-powered-by")
    .use(morgan("dev"))
    .use(urlencoded({ extended: true }))
    .use(json())
    .use(cors())
    .get("/healthz", (_, res) => {
      return res.json({ ok: true });
    })
    .get("/sync", sync);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();
  server.listen(port, () => {
    console.log(`gluetun-sync running on ${port}`);
  });
};
