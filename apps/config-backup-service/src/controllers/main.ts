import * as Express from 'express'

export const healthz = (_, res: Express.Response) => {
    res.json({ status: 'ok' })
}

export const api = (_, res: Express.Response) => {
    res.send({ message: 'Welcome to config-backup-service!!!' })
}