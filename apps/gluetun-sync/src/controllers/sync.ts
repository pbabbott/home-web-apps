import { syncPorts } from "../services/syncService"
import { Request, Response } from 'express'

export const sync = async (req: Request, res: Response) => {

    try{
        const result = await syncPorts()

        console.log('syncResult', result)
        
        if (result.success)
            return res.status(200).json({message: result.validationMessage })

        return res.status(502).json({ message: result.validationMessage })
    }
    catch(err){
        res.status(500).json({message: err})
    }
}