import path from 'path'
import { config } from '../../config'

// TODO: https://github.com/qdm12/gluetun-wiki/blob/main/faq/healthcheck.md
// control server docs

export type ForwardedPortResult = 
{
    port: number
};

export const getForwardedPort = async () => {
    // https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/control-server.md

    const relativeUrl = '/v1/openvpn/portforwarded'
    const uri = path.join(config.gluetun.apiHost, relativeUrl)
    const response = await fetch(uri)
    const data = await response.json();
    return data as ForwardedPortResult
     
}