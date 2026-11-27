import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { BLS_LEGACY_LOW_MASK, BLS_LEGACY_SIGN_BIT, BLS_LEGACY_SIGN_SHIFT } from '@renderer/constants/masternodeKeys'

export function blsLegacyPublicKeyHex(basicBytes: Uint8Array): string {
  const legacy = Uint8Array.from(basicBytes)
  legacy[0] = (basicBytes[0] & BLS_LEGACY_LOW_MASK) | ((basicBytes[0] & BLS_LEGACY_SIGN_BIT) << BLS_LEGACY_SIGN_SHIFT)
  return bytesToHex(legacy)
}

export function blsLegacyHexFromBasicHex(basicHex: string): string | null {
  const normalized = basicHex.trim().toLowerCase()
  if (!/^[0-9a-f]{96}$/.test(normalized)) return null
  return blsLegacyPublicKeyHex(hexToBytes(normalized))
}
