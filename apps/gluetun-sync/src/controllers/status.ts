import { Request, Response } from "express"
import {getStatusRecord, StatusRecord} from '../data/index'
import { showPublicIp } from "../services/publicIpService"
import { getForwardedPort } from "../api/gluetun/gluetun"
import { getApplicationPreferences, login } from "../api/qbittorrent"

export type StatusResult = {
    result: StatusRecord
}
export const getStatus  = async (req: Request, res: Response) => {
    const statusRecord = getStatusRecord()

    const statusResult: StatusResult = {
        result: statusRecord
    }

    res.status(200).json(statusResult)
}

export type PortsResult = {
    gluetunPort: string | null,
    qbitTorrentPort: string | null
}
export const getPorts = async (_: Request, res: Response) => {
    const gluetunPort = await getForwardedPort();
    const qbitTorrentLoginResult = await login();
    let qbitTorrentPort = null
    if (qbitTorrentLoginResult !== null){
        const preferences = await getApplicationPreferences(qbitTorrentLoginResult);
        qbitTorrentPort = preferences?.listen_port.toString()
    }

    const result: PortsResult = {
        gluetunPort: gluetunPort?.port.toString(),
        qbitTorrentPort
    }

    res.status(200).json({ result })
}

export const getPublicIp  = async (req: Request, res: Response) => {
    const publicIP = await showPublicIp()

    if (publicIP === null)
        res.status(503).json({ message: 'Could not get public IP' })
    else
        res.status(200).json({ result: publicIP })

}

