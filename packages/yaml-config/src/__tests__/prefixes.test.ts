import path from 'path'
import { loadConfig } from '../lib/config'
import { ProjectConfig, expectedData, setEnvironmentVariables } from '../fixtures/config-sections'

describe('Project Config with Section Prefixes Tests', () => {

    let sut: ProjectConfig

    const defaultConfig = new ProjectConfig()
    
    beforeAll(async () => {
        setEnvironmentVariables()
        const configPath = path.resolve('./src/fixtures/config-sections/index.yml')
        sut = await loadConfig(defaultConfig, configPath)
    })

    it('Should use env for oneCoolString', () => {
        expect(sut.oneCoolString).toBe(expectedData.oneCoolString)
    })

    it('Should use env for logging.apiKey', () => {
        expect(sut.logging.apiKey).toBe(expectedData.loggingAPIKey)
    })

    it('Should use env for logging.level', () => {
        expect(sut.logging.level).toBe(expectedData.loggingLevel)
    })

    it('Should use yaml for logging.format', () => {
        expect(sut.logging.format).toBe('console')
    })

    it('Should use env for weather.apiKey', () => {
        expect(sut.weather.apiKey).toBe(expectedData.weatherAPIKey)
    })

    it('Should use default for weather.desiredWeather', () => {
        expect(sut.weather.desiredWeather).toBe(defaultConfig.weather.desiredWeather)
    })

    it('Should use yaml for weather.updateFrequency', () => {
        expect(sut.weather.updateFrequency).toBe('daily')
    })

})