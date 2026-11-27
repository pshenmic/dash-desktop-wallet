import { describe, expect, it } from 'vitest'
import { bech32m, createBase58check } from '@scure/base'
import { sha256 } from '@noble/hashes/sha2.js'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { resolveAddressLabel } from '../../src/renderer/src/utils/addressLabels'
import { classifyDestinationAddress } from '../../src/renderer/src/utils/destinationAddress'

const base58check = createBase58check(sha256)
const testnetCore = base58check.encode(Uint8Array.from([140, ...Array(20).fill(1)]))
const mainnetCore = base58check.encode(Uint8Array.from([76, ...Array(20).fill(1)]))
const testnetPlatform = bech32m.encode('tdash', bech32m.toWords(Uint8Array.from([0xb0, ...Array(20).fill(2)])))
const mainnetPlatform = bech32m.encode('dash', bech32m.toWords(Uint8Array.from([0xb0, ...Array(20).fill(2)])))
const shieldedAddress = `utest1${'q'.repeat(65)}`
const identityId = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

describe('resolveAddressLabel', () => {
  it('locks editing and shows the Receive payment request label when one exists', () => {
    expect(resolveAddressLabel('Manual Label', '  Invoice #42  ')).toEqual({
      label: 'Invoice #42',
      lockedByReceive: true,
    })
  })

  it('allows editing and falls back to the address label when no Receive label is set', () => {
    expect(resolveAddressLabel('  Cold Storage  ', null)).toEqual({
      label: 'Cold Storage',
      lockedByReceive: false,
    })
    expect(resolveAddressLabel('Cold Storage', '   ')).toEqual({
      label: 'Cold Storage',
      lockedByReceive: false,
    })
  })

  it('normalizes empty and whitespace-only labels to null', () => {
    expect(resolveAddressLabel('', null)).toEqual({ label: null, lockedByReceive: false })
    expect(resolveAddressLabel('   ', '')).toEqual({ label: null, lockedByReceive: false })
  })
})

describe('classifyDestinationAddress', () => {
  it('detects network-scoped Core, Platform, Shielded, and Identity destinations', () => {
    expect(classifyDestinationAddress(testnetCore, 'testnet')).toBe(DestinationKind.CoreAddress)
    expect(classifyDestinationAddress(testnetCore, 'mainnet')).toBeNull()
    expect(classifyDestinationAddress(mainnetCore, 'mainnet')).toBe(DestinationKind.CoreAddress)

    expect(classifyDestinationAddress(testnetPlatform, 'testnet')).toBe(DestinationKind.PlatformAddress)
    expect(classifyDestinationAddress(testnetPlatform, 'mainnet')).toBeNull()
    expect(classifyDestinationAddress(mainnetPlatform, 'mainnet')).toBe(DestinationKind.PlatformAddress)

    expect(classifyDestinationAddress(shieldedAddress, 'testnet')).toBe(DestinationKind.Shielded)
    expect(classifyDestinationAddress(identityId, 'testnet')).toBe(DestinationKind.Identity)
  })

  it('returns null for empty or unrecognized values', () => {
    expect(classifyDestinationAddress('   ', 'testnet')).toBeNull()
    expect(classifyDestinationAddress('not-an-address', 'testnet')).toBeNull()
  })
})
