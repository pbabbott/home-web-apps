import { getEnvConfig } from '../lib/environment'
import { ProjectConfig, expectedData, setEnvironmentVariables } from '../fixtures/simple'

describe('Environment Variable Test', () => {

    let sut: any

    const defaultConfig = new ProjectConfig()
    
    beforeAll(async () => {
        setEnvironmentVariables()
        sut = getEnvConfig(defaultConfig)
    })

    it('should have oneCoolString set from environment', () => {
        expect(sut.oneCoolString).toBe(expectedData.expectedString)
    })

    it('should have oneCoolNumber set from environment', () => {
        expect(sut.oneCoolNumber).toBe(expectedData.expectedNumber)
    })

    it('should have customString set from environment', () => {
        expect(sut.customString).toBe(expectedData.expectedCustomConfigString)
    })

    it('should have oneCoolSubType set from environment', () => {
        expect(sut.section.oneCoolSubType).toBe(expectedData.subTypeString)
    })

    it('should have section.details.myProperty set from environment', () => {
        expect(sut.section.details.myProperty).toBe(expectedData.expectedSubSubTypeString)
    })    
})
