import { config } from '../config';

export type ServicesResult = {
  gluetun: boolean;
  qbittorrent: boolean;
};

const CHECK_TIMEOUT_MS = 3000;

const isUp = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
};

// A plain 200 check of each upstream. Gluetun's /v1/portforward is its
// unauthenticated route; qBittorrent's root serves the WebUI.
export const checkServices = async (): Promise<ServicesResult> => {
  const [gluetun, qbittorrent] = await Promise.all([
    isUp(`${config.gluetun.apiHost}/v1/portforward`),
    isUp(`${config.qbitTorrent.apiHost}/`),
  ]);
  return { gluetun, qbittorrent };
};
