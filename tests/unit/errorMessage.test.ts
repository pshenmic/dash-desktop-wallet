import {describe, it, expect} from 'vitest'
import {errorMessage} from '../../src/main/src/utils/errorMessage'

describe('errorMessage', () => {
  it('reads an Error’s message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('passes a string through', () => {
    expect(errorMessage('boom')).toBe('boom')
  })

  it('stringifies anything else', () => {
    expect(errorMessage({code: 42})).toBe('[object Object]')
    expect(errorMessage(null)).toBe('null')
    expect(errorMessage(undefined)).toBe('undefined')
  })
})
