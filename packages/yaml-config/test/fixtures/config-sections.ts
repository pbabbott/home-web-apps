import { EnvironmentVariable, ConfigSection, AppConfig } from 'src/lib/decorators'

@AppConfig({ appPrefix: 'YAML_CONFIG'})
export class ProjectConfig {
    @EnvironmentVariable()
    oneCoolString = 'hello'

    @ConfigSection({sectionPrefix: "LOGS"})
    logging = new LoggingConfig()

    @ConfigSection()
    weather = new WeatherConfig()
}

export class LoggingConfig {
    @EnvironmentVariable()
    apiKey = ''

    @EnvironmentVariable()
    level = 'warn'

    format = 'json'
}

export class WeatherConfig {
    @EnvironmentVariable()
    apiKey = ''

    desiredWeather = 'sunny'

    updateFrequency = 'weekly'
}

