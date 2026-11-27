import { describe, expect, it } from 'vitest'
import { PrivateKey } from 'dash-core-sdk'
import type { ImportedMasternodeKeyDto, MasternodeDto } from '@renderer/api/types'
import { MANAGE_KEYS_COPY } from '@renderer/constants/masternodeNodes'
import {
  detectedNetworkMismatchMessage,
  detectMasternodePrivateKey,
  detectMasternodePrivateKeys,
  extractPastedKeyTokens,
  importRoleButtonLabel,
  normalizePastedMasternodeKey,
} from '@renderer/utils/masternodeKeyDetection'

function makeNode(overrides: Partial<MasternodeDto> = {}): MasternodeDto {
  return {
    proTxHash: 'a'.repeat(64),
    type: 'Regular',
    status: 'ENABLED',
    posePenaltyScore: 0,
    collateralTxid: 'b'.repeat(64),
    collateralVout: 0,
    collateralAddress: 'yCollateralAddr',
    serviceAddress: '203.0.113.10:19999',
    payeeAddress: 'yPayeeAddr',
    ownerAddress: 'yOwnerAddr',
    votingAddress: 'yVotingAddr',
    operatorPublicKey: '89'.repeat(48),
    ownerKeyIndex: null,
    votingKeyIndex: null,
    operatorKeyIndex: null,
    importedRoles: [],
    importedSigningRoles: [],
    platformNodeId: null,
    platformP2PPort: null,
    platformHttpPort: null,
    lastPaidBlock: 0,
    lastPaidTime: 0,
    registeredHeight: null,
    isShared: false,
    shares: null,
    ...overrides,
  }
}

const sampleSecretBytes = Uint8Array.from({ length: 32 }, (_, idx) => idx + 1)
const testnetWif = PrivateKey.fromBytes(sampleSecretBytes, 'testnet', true).toWIF()
const testnetAddress = PrivateKey.fromWIF(testnetWif).getAddress()
const mainnetWif = PrivateKey.fromBytes(sampleSecretBytes, 'mainnet', true).toWIF()
const mainnetAddress = PrivateKey.fromWIF(mainnetWif).getAddress()

const sampleBlsHex = '00'.repeat(31) + '01'

describe('normalizePastedMasternodeKey', () => {
  it('trims whitespace and strips optional dash.conf masternodeblsprivkey prefix', () => {
    expect(normalizePastedMasternodeKey(`  masternodeblsprivkey = ${sampleBlsHex}  `)).toBe(sampleBlsHex)
    expect(normalizePastedMasternodeKey(`  MASTERNODEBLSPRIVKEY=${sampleBlsHex}`)).toBe(sampleBlsHex)
    expect(normalizePastedMasternodeKey(`  ${testnetWif} \n`)).toBe(testnetWif)
  })
})

describe('detectMasternodePrivateKey', () => {
  it('returns empty for whitespace-only input', () => {
    expect(detectMasternodePrivateKey('   ', 'testnet', [], [])).toEqual({ kind: 'empty' })
  })

  it('detects 64-hex BLS secret key (with optional prefix) as operator and computes public key', () => {
    const res = detectMasternodePrivateKey(`masternodeblsprivkey=${sampleBlsHex.toUpperCase()}`, 'testnet', [], [])
    expect(res.kind).toBe('bls')
    if (res.kind !== 'bls') throw new Error('expected bls')
    expect(res.role).toBe('operator')
    expect(res.normalizedKey).toBe(sampleBlsHex)
    expect(res.publicKey).toMatch(/^97f1d3a73197/)
    expect(res.publicKey).toHaveLength(96)
    expect(res.matchedService).toBeNull()
    expect(res.alreadyImported).toBe(false)

    const nodeWithOperator = makeNode({ operatorPublicKey: res.publicKey.toUpperCase() })
    const imported: ImportedMasternodeKeyDto[] = [{ role: 'operator', publicKey: res.publicKey, hasPrivateKey: true }]
    const matched = detectMasternodePrivateKey(sampleBlsHex, 'testnet', [nodeWithOperator], imported)
    expect(matched.kind).toBe('bls')
    if (matched.kind !== 'bls') throw new Error('expected bls')
    expect(matched.matchedService).toBe('203.0.113.10:19999')
    expect(matched.alreadyImported).toBe(true)
  })

  it('rejects all-zero 64-hex string as invalid BLS scalar', () => {
    const res = detectMasternodePrivateKey('00'.repeat(32), 'testnet', [], [])
    expect(res).toEqual({ kind: 'invalid', message: MANAGE_KEYS_COPY.invalidKeyFormat })
  })

  it('detects testnet WIF, derives exact P2PKH address, and suggests matching role from nodes', () => {
    const ownerNode = makeNode({ ownerAddress: testnetAddress })
    const votingNode = makeNode({ ownerAddress: 'yOtherOwner', votingAddress: testnetAddress })
    const sharedNode = makeNode({
      isShared: true,
      ownerAddress: null,
      shares: [{ ownerAddress: testnetAddress, amountDuffs: 50_000_000_000n, keyIndex: null, imported: false, canSign: false }],
    })

    const unmatched = detectMasternodePrivateKey(testnetWif, 'testnet', [], [])
    expect(unmatched).toEqual({
      kind: 'wif',
      normalizedKey: testnetWif,
      keyNetwork: 'testnet',
      address: testnetAddress,
      networkMismatch: false,
      matchedRole: null,
      matchedService: null,
      alreadyImportedRoles: [],
    })

    const asOwner = detectMasternodePrivateKey(testnetWif, 'testnet', [ownerNode], [])
    expect(asOwner.kind).toBe('wif')
    if (asOwner.kind === 'wif') {
      expect(asOwner.matchedRole).toBe('owner')
      expect(asOwner.matchedService).toBe('203.0.113.10:19999')
    }

    const asVoting = detectMasternodePrivateKey(testnetWif, 'testnet', [votingNode], [{ role: 'voting', publicKey: testnetAddress, hasPrivateKey: true }])
    expect(asVoting.kind).toBe('wif')
    if (asVoting.kind === 'wif') {
      expect(asVoting.matchedRole).toBe('voting')
      expect(asVoting.alreadyImportedRoles).toEqual(['voting'])
    }

    const asSharedOwner = detectMasternodePrivateKey(testnetWif, 'testnet', [sharedNode], [])
    expect(asSharedOwner.kind).toBe('wif')
    if (asSharedOwner.kind === 'wif') {
      expect(asSharedOwner.matchedRole).toBe('owner')
    }
  })

  it('flags networkMismatch when pasting mainnet WIF on testnet wallet or vice versa', () => {
    const res = detectMasternodePrivateKey(mainnetWif, 'testnet', [], [])
    expect(res.kind).toBe('wif')
    if (res.kind !== 'wif') throw new Error('expected wif')
    expect(res.keyNetwork).toBe('mainnet')
    expect(res.address).toBe(mainnetAddress)
    expect(res.networkMismatch).toBe(true)
    expect(detectedNetworkMismatchMessage('mainnet', 'testnet')).toBe(
      'This key belongs to mainnet, but this wallet is on testnet.',
    )
  })

  it('returns invalid for garbage input and formats import button labels', () => {
    expect(detectMasternodePrivateKey('not-a-valid-key', 'testnet', [], [])).toEqual({
      kind: 'invalid',
      message: MANAGE_KEYS_COPY.invalidKeyFormat,
    })
    expect(importRoleButtonLabel('owner')).toBe('Import Owner key')
    expect(importRoleButtonLabel('voting')).toBe('Import Voting key')
    expect(importRoleButtonLabel('operator')).toBe('Import Operator key')
  })

  it('extracts and auto-detects multiple mixed WIF and BLS keys from textarea paste', () => {
    const pasted = [
      `masternodeblsprivkey=${sampleBlsHex.toUpperCase()}`,
      `owner: ${testnetWif}`,
      `${sampleBlsHex}, garbage-token`,
    ].join('\n')
    expect(extractPastedKeyTokens(pasted)).toEqual([sampleBlsHex.toUpperCase(), testnetWif, 'garbage-token'])

    const ownerNode = makeNode({ ownerAddress: testnetAddress })
    const items = detectMasternodePrivateKeys(pasted, 'testnet', [ownerNode], [])
    expect(items).toHaveLength(3)
    expect(items[0].detection.kind).toBe('bls')
    expect(items[1].detection.kind).toBe('wif')
    if (items[1].detection.kind === 'wif') {
      expect(items[1].detection.matchedRole).toBe('owner')
    }
    expect(items[2].detection.kind).toBe('invalid')
  })
})
