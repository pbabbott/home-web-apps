import * as dotenv from 'dotenv'
import { ConfigSection, EnvironmentVariable, EnvironmentVariableType, loadConfig } from '@abbottland/yaml-config'
import { errorExit } from './process'

export class ApplicationConfig {

    @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
    port: number = 4000

    @ConfigSection({ sectionPrefix: "GLUETUN" })
    gluetun = new GluetunConfig()

    @ConfigSection({ sectionPrefix: "QBITTORRENT" })
    qbitTorrent = new QbitTorrentConfig()
}

export class GluetunConfig {
    @EnvironmentVariable()
    apiHost: string = ''
}

export class QbitTorrentConfig {
    @EnvironmentVariable()
    apiHost: string = ''

    @EnvironmentVariable()
    username: string = ''

    @EnvironmentVariable()
    password: string = ''
}

export let config: ApplicationConfig;

export const initConfig = async () => {

    dotenv.config()
    
    const defaultConfig = new ApplicationConfig()
    config = await loadConfig(defaultConfig)

    console.log('config', config)
}

export const validateConfig = () => {
    const errors: string[] = []

    if (config.gluetun.apiHost === '') errors.push('gluetun.apiHost')
    if (config.qbitTorrent.apiHost === '') errors.push('qbitTorrent.apiHost')
    if (config.qbitTorrent.username === '') errors.push('qbitTorrent.username')
    if (config.qbitTorrent.password === '') errors.push('qbitTorrent.password')

    if (errors.length) {
        errors.map(x => {
            console.error('Missing config variable: ' + x)
        });
        errorExit()
    }
}