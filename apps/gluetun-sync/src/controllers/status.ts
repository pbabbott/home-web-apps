import { Request, Response } from "express"
import {getStatusRecord} from '../data/index'
import { showPublicIp } from "../services/publicIpService"
import { getForwardedPort } from "../api/gluetun/gluetun"
import { getApplicationPreferences, login } from "../api/qbittorrent"

export const getStatus  = async (req: Request, res: Response) => {

    const statusRecord = getStatusRecord()

    res.status(200).json({
        result: statusRecord
    })
}

export const getPorts = async (req: Request, res: Response) => {

    const gluetunPort = await getForwardedPort();

    const qbitTorrentLoginResult = await login();
    let qbitTorrentPort = null
    if (qbitTorrentLoginResult !== null){
        const preferences = await getApplicationPreferences(qbitTorrentLoginResult);
        qbitTorrentPort = preferences?.listen_port.toString()
    }

    res.status(200).json({
        result: {
            gluetunPort: gluetunPort?.port.toString(),
            qbitTorrentPort
        }
    })
}



export const getPublicIp  = async (req: Request, res: Response) => {
    const publicIP = await showPublicIp()

    if (publicIP === null)
        res.status(503).json({message: 'Could not get public IP' })
    else
        res.status(200).json({ result: publicIP })

}

