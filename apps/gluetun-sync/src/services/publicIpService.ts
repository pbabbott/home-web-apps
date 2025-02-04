import { getIpAddress } from '../api/ip/ipify';
export const showPublicIp = async () => {
  try {
    const ipAddress = await getIpAddress();
    return ipAddress;
  } catch (err) {
    console.log('Could not get ip address', err);
    return null;
  }
};
