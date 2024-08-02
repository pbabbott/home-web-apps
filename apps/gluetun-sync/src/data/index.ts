
// TODO: move this to redis
const myDb:StatusRecord = {}

export type StatusRecord = {
    lastCronStart?: Date,
    lastCronEnd?: Date,
    lastSuccess?: Date,
    lastFailure?: Date
    lastFailureMessage?: string
    lastAttempt?: Date,
    lastAttemptBy?: SyncCaller
}

export enum SyncCaller {
    CRON = "CRON",

    API = "API"
}

export const getStatusRecord = () => {
    return myDb
}

export const logAttempt = (callerIdentity: SyncCaller) => {
    myDb.lastAttempt = new Date()
    myDb.lastAttemptBy = callerIdentity
}

export const logSuccess = () => {
    myDb.lastSuccess = new Date()
}
export const logFailure = (lastFailureMessage: string) => {
    myDb.lastFailure = new Date()
    myDb.lastFailureMessage = lastFailureMessage
}

export const logCronStart = () => {
    myDb.lastCronStart = new Date()
}

export const logCronEnd = () => {
    myDb.lastCronEnd = new Date()
}