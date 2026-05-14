import { config } from '../../config';

// https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/control-server.md

export type ForwardedPortResult = {
  port: number;
};

export const getForwardedPort = async () => {
  try {
    const uri = `${config.gluetun.apiHost}/v1/portforward`;
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Gluetun API error: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    return data as ForwardedPortResult;
  } catch (err) {
    console.error('Error getting forwarded port from gluetun: ', err);
    return null;
  }
};
