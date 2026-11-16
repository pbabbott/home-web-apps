import { getPublicIpInfo } from '../api/gluetun/gluetun';
import { getIpAddress } from '../api/ip/ipify';

export type PublicIpResult = {
  ip: string;
  region: string | null;
  country: string | null;
  city: string | null;
};

// Location comes from gluetun when it's reachable; ipify is the fallback for
// the address itself, so `ip` keeps working when gluetun's route is locked down.
export const showPublicIp = async (): Promise<PublicIpResult | null> => {
  try {
    const info = await getPublicIpInfo();
    const ip = info?.public_ip || (await getIpAddress())?.ip;
    if (!ip) return null;
    return {
      ip,
      region: info?.region || null,
      country: info?.country || null,
      city: info?.city || null,
    };
  } catch (err) {
    console.log('Could not get ip address', err);
    return null;
  }
};
