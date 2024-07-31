import { getIpAddress } from "./api/ip/ipify";
import { createServer } from "./server";

const showIp = async () => {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "production") {
    const ipAddress = await getIpAddress();
    if (ipAddress != null) {
      console.info(`IP Address is: ${ipAddress.ip}`);
    }
  } else {
    console.debug(`Not showing IP address as NODE_ENV=${nodeEnv}`);
  }
};

const start = () => {
  const port = process.env.PORT || 3001;
  const server = createServer();
  server.listen(port, () => {
    console.log(`gluetun-sync running on ${port}`);
  });

  showIp();
};

start();
