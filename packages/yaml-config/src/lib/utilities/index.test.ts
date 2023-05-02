import { camelToSnakeCase} from './index'

describe('camelToSnakeCase', () => {
    it('Should handle a single word', () => {
        const sut = camelToSnakeCase('section')
        expect(sut).toBe('SECTION')
    })
    it('Should handle two words', () => {
        const sut = camelToSnakeCase('customString')
        expect(sut).toBe('CUSTOM_STRING')
    })
    it('Should handle three words', () => {
        const sut = camelToSnakeCase('oneCoolBoolean')
        expect(sut).toBe('ONE_COOL_BOOLEAN')
    })
})