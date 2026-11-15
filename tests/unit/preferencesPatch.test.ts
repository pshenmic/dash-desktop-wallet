import {describe, it, expect} from 'vitest'
import {Preferences} from '../../src/main/src/preferences'

describe('Preferences patch methods', () => {
  it('applyGeneral changes one field and keeps every sibling', async () => {
    const preferences = Preferences.default()
    const before = preferences.toJSON()

    await preferences.applyGeneral({logLevel: 'debug'})

    const after = preferences.toJSON()
    expect(after.general.logLevel).toBe('debug')
    expect({...after.general, logLevel: before.general.logLevel}).toEqual(before.general)
    expect(after.network).toEqual(before.network)
  })

  it('applyNetworkOverride changes one network entry and keeps the rest', async () => {
    const preferences = Preferences.default()
    const before = preferences.toJSON()

    await preferences.applyNetworkOverride('testnet', {dnsSeeds: ['seed.example']})

    const after = preferences.toJSON()
    expect(after.network.testnet.dnsSeeds).toEqual(['seed.example'])
    expect(after.network.mainnet).toEqual(before.network.mainnet)
    expect(after.network.mode).toEqual(before.network.mode)
    expect(after.network.dapi).toEqual(before.network.dapi)
    expect(after.general).toEqual(before.general)
  })
})