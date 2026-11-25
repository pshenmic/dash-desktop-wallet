import { describe, expect, it } from 'vitest'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'
import {
  activeKeysCount,
  identityAddKeysHref,
  identityHref,
  isIdentityKeyActive,
  isIdentityKeyExpired,
  isIdentityKeyUsable,
} from '../../src/renderer/src/utils/identities'

const IDENTIFIER = 'B7kcEqgCRhLp2Wq5WZbeT4yUcZR8BWh3X1o3qDtLCpQH'

const DISABLED_AT = 1_700_000_000_000
const NOW = 1_700_000_000_000

function key(keyId: number, disabled = false, expiresAt: number | null = null): IdentityKeyDto {
  return {
    keyId,
    purpose: 'AUTHENTICATION',
    securityLevel: 'HIGH',
    keyType: 'ECDSA_SECP256K1',
    data: '',
    readOnly: false,
    disabledAt: disabled ? DISABLED_AT : null,
    contractBounds: null,
    expiresAt,
  }
}

describe('identity routes', () => {
  it('builds the identity page and its add-keys wizard paths', () => {
    expect(identityHref(IDENTIFIER)).toBe(`/identities/${IDENTIFIER}`)
    expect(identityAddKeysHref(IDENTIFIER)).toBe(`/identities/${IDENTIFIER}/keys/new`)
  })
})

describe('activeKeysCount', () => {
  it('skips disabled keys', () => {
    expect(activeKeysCount([key(0), key(1, true), key(2)])).toBe(2)
    expect(activeKeysCount([])).toBe(0)
  })
})

describe('identity key active, expired, and usable predicates', () => {
  it('distinguishes active, disabled, and expired keys at expiresAt <= now', () => {
    const unexpired = key(0, false, NOW + 1)
    const atBoundary = key(1, false, NOW)
    const past = key(2, false, NOW - 1)
    const disabledPast = key(3, true, NOW - 1)
    const unlimited = key(4, false, null)

    expect(isIdentityKeyActive(unexpired)).toBe(true)
    expect(isIdentityKeyExpired(unexpired, NOW)).toBe(false)
    expect(isIdentityKeyUsable(unexpired, NOW)).toBe(true)

    expect(isIdentityKeyActive(atBoundary)).toBe(true)
    expect(isIdentityKeyExpired(atBoundary, NOW)).toBe(true)
    expect(isIdentityKeyUsable(atBoundary, NOW)).toBe(false)

    expect(isIdentityKeyActive(past)).toBe(true)
    expect(isIdentityKeyExpired(past, NOW)).toBe(true)
    expect(isIdentityKeyUsable(past, NOW)).toBe(false)

    expect(isIdentityKeyActive(disabledPast)).toBe(false)
    expect(isIdentityKeyExpired(disabledPast, NOW)).toBe(false)
    expect(isIdentityKeyUsable(disabledPast, NOW)).toBe(false)

    expect(isIdentityKeyActive(unlimited)).toBe(true)
    expect(isIdentityKeyExpired(unlimited, NOW)).toBe(false)
    expect(isIdentityKeyUsable(unlimited, NOW)).toBe(true)
  })
})
