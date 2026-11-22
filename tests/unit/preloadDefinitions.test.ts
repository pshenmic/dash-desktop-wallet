import {describe, expect, it} from 'vitest'
import {apiDefinitions} from '../../src/preload/definitions'

describe('preload definitions', () => {
  it('implements every shared registration coordinator channel', () => {
    const invoked: string[] = []
    const definitions = apiDefinitions({
      invoke: (channel: string) => {
        invoked.push(channel)
        return Promise.resolve()
      },
    }) as unknown as Record<string, (...args: never[]) => unknown>

    definitions.buildSharedMasternodeRegistration('wallet' as never, {} as never)
    definitions.combineSharedMasternodeRegistration('wallet' as never, 'hex' as never, [] as never)
    definitions.assembleSharedMasternodeRegistration('wallet' as never, 'hex' as never, [] as never)
    definitions.broadcastSharedMasternodeRegistration('wallet' as never, 'hex' as never)

    expect(invoked).toEqual([
      'buildSharedMasternodeRegistration',
      'combineSharedMasternodeRegistration',
      'assembleSharedMasternodeRegistration',
      'broadcastSharedMasternodeRegistration',
    ])
  })
})
