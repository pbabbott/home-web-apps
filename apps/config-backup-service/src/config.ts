export class ApplicationConfig {
    port = 3333
}

export const defaultConfig = new ApplicationConfig()

export let config = defaultConfig

export const setConfig = (updatedConfig) => {
    config = updatedConfig
}