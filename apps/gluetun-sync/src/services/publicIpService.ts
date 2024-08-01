import { getIpAddress } from "../api/ip/ipify";

export const showPublicIp = async () => {
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