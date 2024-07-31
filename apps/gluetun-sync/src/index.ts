import { createServer } from "./server";
import { log } from "@repo/logger";

const port = process.env.PORT || 3001;
const server = createServer();

server.listen(port, () => {
  log(`gluetun-sync running on ${port}`);
});
