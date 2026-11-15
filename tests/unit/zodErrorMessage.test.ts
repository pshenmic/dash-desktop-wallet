import {describe, it, expect} from 'vitest'
import {z} from 'zod'
import {zodErrorMessage} from '../../src/main/src/utils/zodErrorMessage'

describe('zodErrorMessage', () => {
  it('flattens issues into a channel-prefixed message', () => {
    const error = new z.ZodError([
      {code: 'custom', path: ['network'], message: 'bad network'},
      {code: 'custom', path: ['seeds', 0], message: 'bad seed'},
    ])

    expect(zodErrorMessage('setDnsSeeds', error))
      .toBe('setDnsSeeds: network: bad network, seeds.0: bad seed')
  })
})