import {describe, expect, it} from 'vitest'
import {decryptImportedKey, encryptImportedKey} from '../../src/main/src/utils/importedKeyEncryption'

const SEED = new Uint8Array(64).fill(0x5a)
const OTHER_SEED = new Uint8Array(64).fill(0xa5)
const WIF = 'XwvK7Uo2JZ8m4kQq6hR9nT3pL5sV1yB0cD2eF4gH6jK8mN0pQ'

describe('imported key encryption', () => {
  it('round-trips a private key for the seed that wrote it', () => {
    const blob = encryptImportedKey(WIF, SEED)

    expect(blob).not.toContain(WIF)
    expect(decryptImportedKey(blob, SEED)).toBe(WIF)
  })

  it('refuses a different seed or tampered ciphertext', () => {
    const blob = encryptImportedKey(WIF, SEED)
    const tampered = `${blob.slice(0, -2)}00`

    expect(() => decryptImportedKey(blob, OTHER_SEED)).toThrow()
    expect(() => decryptImportedKey(tampered, SEED)).toThrow()
    expect(() => decryptImportedKey('00', SEED)).toThrow('Not an encrypted imported key')
  })
})