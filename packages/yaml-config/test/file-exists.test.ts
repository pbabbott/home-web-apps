import path from 'path'
import { fileExists } from 'src/services/file'

describe('Check if file exists', () => {
    it('Should detect a file exists', async () => {
        const configPath = path.resolve('./packages/yaml-config/test/fixtures/simple.yml')
        const sut = await fileExists(configPath)
        expect(sut).toBe(true)
    })
    it('Check if file does not exist', async () => {
        const configPath = path.resolve('./packages/yaml-config/test/fixtures/does-not-exist.yml')
        console.log('configPath', configPath)
        const sut = await fileExists(configPath)
        console.log('sut', sut)
        expect(sut).toBe(false)
    })
})
