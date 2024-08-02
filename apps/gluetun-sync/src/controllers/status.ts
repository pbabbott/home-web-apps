import { Request, Response } from "express"
import {getStatusRecord} from '../data/index'

export const getStatus  = async (req: Request, res: Response) => {

    const statusRecord = getStatusRecord()

    res.status(200).json({
        result: statusRecord
    })
}


export const getPublicIp  = async (req: Request, res: Response) => {

}

