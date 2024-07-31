import path from 'path'
import { loadConfig } from '../lib/config'
import { ProjectConfig, expectedData, setEnvironmentVariables } from '../fixtures/simple'
describe('Environment Variable Test', () => {

    let sut: ProjectConfig

    const defaultConfig = new ProjectConfig()
    
    beforeAll(async () => {
        setEnvironmentVariables()
        const configPath = path.resolve('./src/fixtures/simple/index.yml')
        sut = await loadConfig(defaultConfig, configPath)
    })

    it('Should respect default variables', () => {
        expect(sut.section.oneMoreSubType).toBe('bongo')
    })
    it('Should respect variables set in a file', () => {
        expect(sut.oneCoolBoolean).toBe(true)
    })
    it('Should respect environment variable string', () => {
        expect(sut.oneCoolString).toBe(expectedData.expectedString)
    })
    it('Should respect custom environment variable string', () => {
        expect(sut.customString).toBe(expectedData.expectedCustomConfigString)
    })
    it('Should NOT use environment variables when decorator is NOT present', () => {
        expect(sut.section.anotherCoolSubType).toBe('bar')
    })

    it('Should respect environment variable as a number', () => {
        expect(sut.oneCoolNumber).toBe(expectedData.expectedNumber)
    })

    it('Should respect environment variable sub type', () => {
        expect(sut.section.oneCoolSubType).toBe(expectedData.subTypeString)
    })

    it('Should respect environment variable sub-sub type', () => {
        expect(sut.section.details.myProperty).toBe(expectedData.expectedSubSubTypeString)
    })

})