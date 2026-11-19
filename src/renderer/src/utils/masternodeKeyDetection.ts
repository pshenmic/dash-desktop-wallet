import { bls12_381, bls12_381_Fr } from '@noble/curves/bls12-381.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { bytesToNumberBE } from '@noble/curves/utils.js'
import { ripemd160 } from '@noble/hashes/legacy.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { createBase58check } from '@scure/base'
import type { ImportedMasternodeKeyDto, MasternodeDto, MasternodeKeyRole, Network } from '@renderer/api/types'
import {
  BLS_LEGACY_LOW_MASK,
  BLS_LEGACY_SIGN_BIT,
  BLS_LEGACY_SIGN_SHIFT,
  BLS_SECRET_KEY_HEX_PATTERN,
  DASH_CONF_BLS_PREFIX_PATTERN,
  KEY_LINE_PREFIX_PATTERN,
  KEY_TOKEN_SPLIT_PATTERN,
  KEY_WRAPPER_QUOTES_PATTERN,
  P2PKH_VERSION_BYTES,
  WIF_COMPRESSED_FLAG,
  WIF_COMPRESSED_LEN,
  WIF_NETWORK_BY_BYTE,
  WIF_UNCOMPRESSED_LEN,
} from '@renderer/constants/masternodeKeys'
import { MANAGE_KEYS_COPY, MASTERNODE_KEY_ROLE_LABELS } from '@renderer/constants/masternodeNodes'
import type { DetectedMasternodeKey, DetectedMasternodeKeyItem } from '@renderer/types/MasternodeKeyDetection'
import { formatServiceAddress } from './masternodeNodes'

const base58check = createBase58check(sha256)

export function normalizePastedMasternodeKey(raw: string): string {
  return raw.trim().replace(DASH_CONF_BLS_PREFIX_PATTERN, '').trim().replace(KEY_WRAPPER_QUOTES_PATTERN, '').trim()
}

export function extractPastedKeyTokens(raw: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const rawLine of raw.split(/\r?\n/)) {
    const strippedLine = rawLine.trim().replace(KEY_LINE_PREFIX_PATTERN, '').trim()
    if (strippedLine === '') continue
    for (const part of strippedLine.split(KEY_TOKEN_SPLIT_PATTERN)) {
      const cleaned = normalizePastedMasternodeKey(part)
      if (cleaned === '') continue
      const dedupeKey = BLS_SECRET_KEY_HEX_PATTERN.test(cleaned) ? cleaned.toLowerCase() : cleaned
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      tokens.push(cleaned)
    }
  }
  return tokens
}

function blsLegacyPublicKeyHex(basicBytes: Uint8Array): string {
  const legacy = Uint8Array.from(basicBytes)
  legacy[0] = (basicBytes[0] & BLS_LEGACY_LOW_MASK) | ((basicBytes[0] & BLS_LEGACY_SIGN_BIT) << BLS_LEGACY_SIGN_SHIFT)
  return bytesToHex(legacy)
}

function nodeLabel(node: MasternodeDto): string {
  const service = formatServiceAddress(node.serviceAddress)
  return node.serviceAddress?.trim() ? service : `${node.proTxHash.slice(0, 10)}…`
}

function findWifMatch(address: string, nodes: MasternodeDto[]): { role: 'owner' | 'voting'; service: string } | null {
  for (const node of nodes) {
    if (node.ownerAddress === address || node.shares?.some(share => share.ownerAddress === address)) {
      return { role: 'owner', service: nodeLabel(node) }
    }
    if (node.votingAddress === address) {
      return { role: 'voting', service: nodeLabel(node) }
    }
  }
  return null
}

function detectBlsKey(
  normalized: string,
  nodes: MasternodeDto[],
  importedKeys: ImportedMasternodeKeyDto[],
): DetectedMasternodeKey {
  const normalizedKey = normalized.toLowerCase()
  const secretBytes = hexToBytes(normalizedKey)
  const scalar = bytesToNumberBE(secretBytes)
  if (!bls12_381_Fr.isValidNot0(scalar)) {
    return { kind: 'invalid', message: MANAGE_KEYS_COPY.invalidKeyFormat }
  }
  const basicBytes = bls12_381.G1.Point.BASE.multiply(scalar).toBytes(true)
  const publicKey = bytesToHex(basicBytes)
  const legacyPublicKey = blsLegacyPublicKeyHex(basicBytes)
  const matchedNode = nodes.find(node => {
    const candidate = node.operatorPublicKey.toLowerCase()
    return candidate === publicKey || candidate === legacyPublicKey
  })
  const alreadyImported = importedKeys.some(item => item.role === 'operator' && item.publicKey.toLowerCase() === publicKey)
  return {
    kind: 'bls',
    normalizedKey,
    role: 'operator',
    publicKey,
    matchedService: matchedNode ? nodeLabel(matchedNode) : null,
    alreadyImported,
  }
}

export function detectMasternodePrivateKey(
  raw: string,
  walletNetwork: Network | null,
  nodes: MasternodeDto[],
  importedKeys: ImportedMasternodeKeyDto[],
): DetectedMasternodeKey {
  const normalized = normalizePastedMasternodeKey(raw)
  if (normalized === '') return { kind: 'empty' }

  if (BLS_SECRET_KEY_HEX_PATTERN.test(normalized)) {
    return detectBlsKey(normalized, nodes, importedKeys)
  }

  let decoded: Uint8Array
  try {
    decoded = base58check.decode(normalized)
  } catch {
    return { kind: 'invalid', message: MANAGE_KEYS_COPY.invalidKeyFormat }
  }

  const keyNetwork = WIF_NETWORK_BY_BYTE[decoded[0]]
  if (keyNetwork == null) {
    return { kind: 'invalid', message: MANAGE_KEYS_COPY.invalidKeyFormat }
  }

  let compressed: boolean
  if (decoded.length === WIF_UNCOMPRESSED_LEN) {
    compressed = false
  } else if (decoded.length === WIF_COMPRESSED_LEN && decoded[WIF_COMPRESSED_LEN - 1] === WIF_COMPRESSED_FLAG) {
    compressed = true
  } else {
    return { kind: 'invalid', message: MANAGE_KEYS_COPY.invalidKeyFormat }
  }

  let pubKey: Uint8Array
  try {
    pubKey = secp256k1.getPublicKey(decoded.slice(1, WIF_UNCOMPRESSED_LEN), compressed)
  } catch {
    return { kind: 'invalid', message: MANAGE_KEYS_COPY.invalidKeyFormat }
  }

  const address = base58check.encode(Uint8Array.of(P2PKH_VERSION_BYTES[keyNetwork], ...ripemd160(sha256(pubKey))))
  const networkMismatch = walletNetwork != null && keyNetwork !== walletNetwork
  const match = findWifMatch(address, nodes)
  const alreadyImportedRoles: MasternodeKeyRole[] = importedKeys
    .filter(item => item.role !== 'operator' && item.publicKey === address)
    .map(item => item.role)

  return {
    kind: 'wif',
    normalizedKey: normalized,
    keyNetwork,
    address,
    networkMismatch,
    matchedRole: match?.role ?? null,
    matchedService: match?.service ?? null,
    alreadyImportedRoles,
  }
}

export function detectedNetworkMismatchMessage(keyNetwork: Network, walletNetwork: Network): string {
  return MANAGE_KEYS_COPY.networkMismatchTemplate
    .replace('{keyNetwork}', keyNetwork)
    .replace('{walletNetwork}', walletNetwork)
}

export function importRoleButtonLabel(role: MasternodeKeyRole): string {
  return MANAGE_KEYS_COPY.importRoleButton.replace('{role}', MASTERNODE_KEY_ROLE_LABELS[role])
}

export function detectMasternodePrivateKeys(
  raw: string,
  walletNetwork: Network | null,
  nodes: MasternodeDto[],
  importedKeys: ImportedMasternodeKeyDto[],
): DetectedMasternodeKeyItem[] {
  return extractPastedKeyTokens(raw).flatMap((token, index) => {
    const detection = detectMasternodePrivateKey(token, walletNetwork, nodes, importedKeys)
    if (detection.kind === 'empty') return []
    const keyId = detection.kind === 'invalid' ? `invalid:${index}:${token}` : `${detection.kind}:${detection.normalizedKey}`
    return [{ id: keyId, rawToken: token, detection }]
  })
}
