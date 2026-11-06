import { describe, expect, it } from 'vitest'
import type { MasternodeDto } from '@renderer/api/types'
import { NodeSegment } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import { filterNodes, masternodeStatus, masternodeType } from '@renderer/utils/masternodeNodes'

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
  platformNodeId: null,
  platformP2PPort: null,
  platformHttpPort: null,
  lastPaidBlock: 0,
  lastPaidTime: 0,
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

  it('uses the backend key index, including zero, to distinguish voting keys', () => {
    expect(filterNodes(nodes, '', NodeSegment.VotingKey)).toEqual([regularNode])
    expect(filterNodes(nodes, '', NodeSegment.NoVotingKey)).toEqual([otherNode])
  })

  it('searches the backend service address and ProTxHash', () => {
    expect(filterNodes(nodes, '192.0.2.1', NodeSegment.Issues)).toEqual([otherNode])
    expect(filterNodes(nodes, ' FIRST ', NodeSegment.All)).toEqual([regularNode])
  })

  it('shows unknown statuses and types as returned by the backend', () => {
    expect(masternodeStatus('UNKNOWN')).toEqual({ tone: StatusPillTone.Inactive, label: 'UNKNOWN' })
    expect(masternodeType('FutureType')).toEqual({ variant: 'muted', text: 'FutureType' })
  })
})
