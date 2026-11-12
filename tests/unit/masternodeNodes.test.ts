import { describe, expect, it } from 'vitest'
import type { MasternodeDto } from '@renderer/api/types'
import { NodeSegment, PayoutChoiceKind, RegistrarKeyChoiceKind } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import {
  buildMasternodeRegistration,
  buildRegistrarUpdate,
  buildServiceUpdate,
  eligibleCollateralUtxos,
  parseOperatorRewardBps,
  validateServiceEndpoint,
} from '@renderer/utils/masternodeActions'
import {
  filterNodes,
  formatServiceAddress,
  hasVotingKey,
  keyOriginBadge,
  masternodeStatus,
  masternodeType,
  nodeRolesLabel,
  nodeVotingAccessLabel,
} from '@renderer/utils/masternodeNodes'

const regularNode: MasternodeDto = {
  proTxHash: 'first',
  type: 'Regular',
  status: 'ENABLED',
  posePenaltyScore: 0,
  collateralTxid: 'collateral',
  collateralVout: 0,
  collateralAddress: 'Xcollateral',
  serviceAddress: '127.0.0.1:9999',
  payeeAddress: 'Xpayee',
  ownerAddress: 'Xowner',
  votingAddress: 'Xvoting',
  operatorPublicKey: 'operator',
  ownerKeyIndex: null,
  votingKeyIndex: 0,
  operatorKeyIndex: null,
  importedRoles: [],
  platformNodeId: null,
  platformP2PPort: null,
  platformHttpPort: null,
  lastPaidBlock: 0,
  lastPaidTime: 0,
  registeredHeight: null,
}

const otherNode: MasternodeDto = {
  ...regularNode,
  proTxHash: 'second',
  serviceAddress: '192.0.2.1:9999',
  status: 'POSE_BANNED',
  votingKeyIndex: null,
}

describe('Masternode display', () => {
  const nodes = [otherNode, regularNode]

  it('uses the backend key index or imported role to distinguish voting keys', () => {
    expect(filterNodes(nodes, '', NodeSegment.VotingKey)).toEqual([regularNode])
    expect(filterNodes(nodes, '', NodeSegment.NoVotingKey)).toEqual([otherNode])
    const importedVoting: MasternodeDto = { ...otherNode, importedRoles: ['voting'] }
    expect(hasVotingKey(importedVoting)).toBe(true)
    expect(nodeVotingAccessLabel(importedVoting)).toBe('Imported key')
  })

  it('searches the backend service address and ProTxHash and handles null serviceAddress', () => {
    expect(filterNodes(nodes, '192.0.2.1', NodeSegment.Issues)).toEqual([otherNode])
    expect(filterNodes(nodes, ' FIRST ', NodeSegment.All)).toEqual([regularNode])
    const nullService: MasternodeDto = { ...regularNode, serviceAddress: null }
    expect(filterNodes([nullService], 'first', NodeSegment.All)).toEqual([nullService])
    expect(formatServiceAddress(null)).toBe('Unassigned')
    expect(formatServiceAddress('0.0.0.0:0')).toBe('Unassigned')
  })

  it('shows unknown statuses and types as returned by the backend', () => {
    expect(masternodeStatus('UNKNOWN')).toEqual({ tone: StatusPillTone.Inactive, label: 'UNKNOWN' })
    expect(masternodeType('FutureType')).toEqual({ variant: 'muted', text: 'FutureType' })
  })

  it('summarises wallet and imported roles and key origins', () => {
    const multiRole: MasternodeDto = {
      ...regularNode,
      ownerKeyIndex: 1,
      votingKeyIndex: null,
      importedRoles: ['operator'],
    }
    expect(nodeRolesLabel(multiRole)).toBe('Owner · Operator')
    expect(keyOriginBadge(multiRole, 'owner').text).toBe('Wallet key')
    expect(keyOriginBadge(multiRole, 'operator').text).toBe('Imported')
    expect(keyOriginBadge(multiRole, 'voting').text).toBe('External')
  })
})

describe('Masternode action builders', () => {
  const txid = 'a'.repeat(64)

  it('filters confirmed unspent coins matching exact collateral duffs and not flagged as collateral', () => {
    const coins = [
      { txid, vout: 0, address: 'X1', satoshis: 100_000_000_000n, height: 100, timestamp: null, confirmations: 6, collateral: false },
      { txid, vout: 1, address: 'X2', satoshis: 100_000_000_000n, height: 100, timestamp: null, confirmations: 6, collateral: true },
      { txid, vout: 2, address: 'X3', satoshis: 100_000_000_000n, height: 0, timestamp: null, confirmations: 0, collateral: false },
      { txid, vout: 3, address: 'X4', satoshis: 400_000_000_000n, height: 100, timestamp: null, confirmations: 6, collateral: false },
    ]
    expect(eligibleCollateralUtxos(coins, 'Regular')).toHaveLength(1)
    expect(eligibleCollateralUtxos(coins, 'Evo')).toHaveLength(1)
  })

  it('parses operator reward percentage into basis points and validates service endpoints', () => {
    expect(parseOperatorRewardBps('0')).toBe(0)
    expect(parseOperatorRewardBps('5.25')).toBe(525)
    expect(parseOperatorRewardBps('100')).toBe(10000)
    expect(parseOperatorRewardBps('100.01')).toBeNull()
    expect(validateServiceEndpoint('203.0.113.10:9999', 'mainnet').error).toBeNull()
    expect(validateServiceEndpoint('203.0.113.10:19999', 'mainnet').error).toContain('9999')
    expect(validateServiceEndpoint('203.0.113.10:9999', 'testnet').error).toContain('9999')
  })

  it('builds Regular and Evo masternode registrations and registrar/service updates', () => {
    const reg = buildMasternodeRegistration({
      type: 'Regular',
      collateralOutpoint: `${txid}:0`,
      payoutAddress: 'Xpayee',
      serviceAddress: '',
      operatorRewardPercent: '2.5',
      platformNodeId: '',
      platformP2PPort: '26656',
      platformHttpPort: '443',
      network: 'mainnet',
    })
    expect(reg.error).toBeNull()
    expect(reg.dto).toEqual({
      type: 'Regular',
      collateral: { txid, vout: 0 },
      serviceAddress: null,
      payoutAddress: 'Xpayee',
      operatorReward: 250,
      platformNodeId: null,
      platformP2PPort: null,
      platformHttpPort: null,
    })

    const updReg = buildRegistrarUpdate({
      payoutChoice: PayoutChoiceKind.Keep,
      payoutAddress: '',
      currentPayeeAddress: 'Xpayee',
      operatorChoice: RegistrarKeyChoiceKind.Wallet,
      operatorPublicKey: '',
      votingChoice: RegistrarKeyChoiceKind.Keep,
      votingAddress: '',
    })
    expect(updReg.error).toBeNull()
    expect(updReg.dto?.operator).toEqual({ kind: 'wallet' })

    const updSrv = buildServiceUpdate({
      type: 'Evo',
      serviceAddress: '203.0.113.10:19999',
      operatorPayoutAddress: '',
      platformNodeId: 'b'.repeat(40),
      platformP2PPort: '26656',
      platformHttpPort: '1443',
      network: 'testnet',
    })
    expect(updSrv.error).toBeNull()
    expect(updSrv.dto?.platformP2PPort).toBe(26656)
  })
})
