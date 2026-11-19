import { describe, expect, it } from 'vitest'
import { PrivateKey } from 'dash-core-sdk'
import type { ConnectionType, MasternodeDto, MasternodeKeyRole, OwnedMasternodeShareDto } from '@renderer/api/types'
import { DUFFS_PER_DASH } from '@renderer/constants/balance'
import { MANAGE_KEYS_COPY, NODES_TAB_COPY, NODE_DETAIL_COPY } from '@renderer/constants/masternodeNodes'
import { REGISTERING_MASTERNODE_STATUS } from '@renderer/constants/masternodes'
import { NodeSegment, PayoutChoiceKind, RegistrarKeyChoiceKind } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { RegisterWizardDraft } from '@renderer/types/MasternodeRegistrationWizard'
import { classifyVotingMasternodes } from '@renderer/utils/governanceProposals'
import {
  buildMasternodeRegistration,
  buildRegistrarUpdate,
  buildServiceUpdate,
  eligibleCollateralUtxos,
  isConfirmingUtxo,
  isRoutableIpv4,
  parseOperatorRewardBps,
  splitIpPortInput,
  validateRegistrationWizard,
  validateServiceEndpoint,
} from '@renderer/utils/masternodeActions'
import {
  calculateShareSummary,
  canOperateNode,
  canUpdateNodeRegistrar,
  emptyNodesDescription,
  filterNodes,
  formatBlockHeight,
  formatOwnedShareStake,
  formatServiceAddress,
  formatSharePercent,
  hasRoleInWallet,
  hasVotingKey,
  importedKeyStatusMessage,
  isOwnedShare,
  isSharedNode,
  keyOriginBadge,
  masternodeStatus,
  masternodeType,
  nodeAccessDisplay,
  nodeRolesLabel,
  nodeSegmentOptions,
  nodeVotingAccessLabel,
  nodeWalletRoles,
  operateNodeDisabledReason,
  shareOriginBadge,
  shareRatio,
  updateRegistrarDisabledReason,
} from '@renderer/utils/masternodeNodes'

function dash(amount: number): bigint {
  return BigInt(amount) * DUFFS_PER_DASH
}

function makeShare(overrides: Partial<OwnedMasternodeShareDto> = {}): OwnedMasternodeShareDto {
  return {
    ownerAddress: 'XshareOwner',
    amountDuffs: dash(500),
    keyIndex: null,
    imported: false,
    ...overrides,
  }
}

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
  isShared: false,
  shares: null,
}

const otherNode: MasternodeDto = {
  ...regularNode,
  proTxHash: 'second',
  serviceAddress: '192.0.2.1:9999',
  status: 'POSE_BANNED',
  votingKeyIndex: null,
}

function makeNode(overrides: Partial<MasternodeDto> = {}): MasternodeDto {
  return {
    ...regularNode,
    ...overrides,
  }
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
    expect(masternodeStatus('ENABLED')).toEqual({ tone: StatusPillTone.Success, label: 'Active' })
    expect(masternodeStatus('POSE_BANNED')).toEqual({ tone: StatusPillTone.Danger, label: 'PoSe banned' })
    expect(masternodeType('Regular')).toEqual({ variant: 'muted', text: 'Masternode' })
    expect(masternodeType('Evo')).toEqual({ variant: 'accent', text: 'Evonode' })
    expect(formatBlockHeight(123456)).toBe('#123,456')
  })
})

describe('Shared masternode detection and filtering', () => {
  it('identifies shared nodes via isShared or populated shares', () => {
    expect(isSharedNode(makeNode({ isShared: true, shares: null }))).toBe(true)
    expect(isSharedNode(makeNode({ isShared: true, shares: [makeShare()] }))).toBe(true)
    expect(isSharedNode(makeNode({ isShared: false, shares: [makeShare()] }))).toBe(true)
    expect(isSharedNode(makeNode({ isShared: false, shares: null }))).toBe(false)
    expect(isSharedNode(makeNode({ isShared: false, shares: [] }))).toBe(false)
    expect(isSharedNode(makeNode({ isShared: null, shares: null }))).toBe(false)
    expect(isSharedNode(makeNode({ isShared: null, shares: [] }))).toBe(false)
  })

  it('recognizes both votingKeyIndex: 0 and imported voting keys in VotingKey / NoVotingKey segments', () => {
    const importedVotingNode = makeNode({
      proTxHash: 'alpha',
      votingKeyIndex: null,
      importedRoles: ['voting'],
    })
    const nonVotingImportedNode = makeNode({
      proTxHash: 'zeta',
      votingKeyIndex: null,
      importedRoles: ['owner', 'operator'],
    })
    const mixed = [otherNode, nonVotingImportedNode, importedVotingNode, regularNode]

    expect(hasVotingKey(regularNode)).toBe(true)
    expect(hasVotingKey(importedVotingNode)).toBe(true)
    expect(hasVotingKey(nonVotingImportedNode)).toBe(false)
    expect(hasVotingKey(otherNode)).toBe(false)

    expect(filterNodes(mixed, '', NodeSegment.VotingKey)).toEqual([importedVotingNode, regularNode])
    expect(filterNodes(mixed, '', NodeSegment.NoVotingKey)).toEqual([otherNode, nonVotingImportedNode])
  })

  it('filters NodeSegment.Shared and reports segment counts accurately', () => {
    const sharedIndexed = makeNode({
      proTxHash: 'shared-indexed',
      isShared: true,
      votingKeyIndex: null,
      importedRoles: ['voting'],
      shares: [makeShare({ ownerAddress: 'Xshare1', keyIndex: 0 })],
    })
    const sharedRpc = makeNode({
      proTxHash: 'shared-rpc',
      isShared: true,
      votingKeyIndex: null,
      shares: null,
    })
    const list = [otherNode, sharedRpc, regularNode, sharedIndexed]

    expect(filterNodes(list, '', NodeSegment.Shared)).toEqual([sharedIndexed, sharedRpc])
    expect(nodeSegmentOptions(list, '')).toEqual([
      { value: NodeSegment.All, label: 'All · 4' },
      { value: NodeSegment.Shared, label: 'Shared · 2' },
      { value: NodeSegment.VotingKey, label: 'Voting key in wallet · 2' },
      { value: NodeSegment.NoVotingKey, label: 'No voting key in wallet · 2' },
      { value: NodeSegment.Issues, label: 'Issues · 1' },
    ])
    expect(nodeSegmentOptions(list, 'shared-rpc')).toEqual([
      { value: NodeSegment.All, label: 'All · 1' },
      { value: NodeSegment.Shared, label: 'Shared · 1' },
      { value: NodeSegment.VotingKey, label: 'Voting key in wallet · 0' },
      { value: NodeSegment.NoVotingKey, label: 'No voting key in wallet · 1' },
      { value: NodeSegment.Issues, label: 'Issues · 0' },
    ])
  })

  it('searches ownerAddress, payeeAddress, collateralAddress, and shares[].ownerAddress with null fields', () => {
    const sharedWithNulls = makeNode({
      proTxHash: 'shared-nulls',
      serviceAddress: null,
      payeeAddress: null,
      ownerAddress: null,
      collateralAddress: null,
      isShared: true,
      shares: [
        makeShare({ ownerAddress: 'XParticipantOne', amountDuffs: dash(500), keyIndex: 0 }),
        makeShare({ ownerAddress: 'XParticipantTwo', amountDuffs: dash(500) }),
      ],
    })
    const soloWithAddresses = makeNode({
      proTxHash: 'solo-addr',
      serviceAddress: null,
      ownerAddress: 'XSoloOwner',
      payeeAddress: 'XSoloPayee',
      collateralAddress: 'XSoloCollateral',
    })
    const sparseNode = makeNode({
      proTxHash: 'sparse-node',
      serviceAddress: null,
      payeeAddress: null,
      ownerAddress: null,
      collateralAddress: null,
      shares: null,
    })
    const list = [sparseNode, soloWithAddresses, sharedWithNulls]

    expect(filterNodes(list, ' participanttwo ', NodeSegment.Shared)).toEqual([sharedWithNulls])
    expect(filterNodes(list, 'xsoloowner', NodeSegment.All)).toEqual([soloWithAddresses])
    expect(filterNodes(list, 'xsolopayee', NodeSegment.All)).toEqual([soloWithAddresses])
    expect(filterNodes(list, 'xsolocollateral', NodeSegment.All)).toEqual([soloWithAddresses])
    expect(filterNodes(list, 'sparse-node', NodeSegment.All)).toEqual([sparseNode])
    expect(filterNodes(list, 'missing-query', NodeSegment.All)).toEqual([])
  })
})

describe('Share summary and ratio calculations', () => {
  it('computes single wallet share stake (500 Dash of 1000 Dash -> 50%)', () => {
    const zeroIndex = makeShare({ ownerAddress: 'Xzero', amountDuffs: dash(500), keyIndex: 0 })
    const external = makeShare({ ownerAddress: 'Xexternal', amountDuffs: dash(500) })
    expect(isOwnedShare(zeroIndex)).toBe(true)
    const shares = [zeroIndex, external]

    const summary = calculateShareSummary(shares)
    expect(summary).toEqual({
      totalDuffs: dash(1000),
      ownedDuffs: dash(500),
      ownedCount: 1,
      totalCount: 2,
      ownedRatio: 0.5,
    })
    expect(shareRatio(dash(500), dash(1000))).toBe(0.5)
    expect(formatSharePercent(0.5)).toBe('50%')
    expect(formatOwnedShareStake(summary!)).toBe('500 / 1000 Dash (50%)')
  })

  it('aggregates multiple wallet shares from derived and imported keys', () => {
    const derived = makeShare({ ownerAddress: 'Xderived', amountDuffs: dash(200), keyIndex: 1, imported: false })
    const imported = makeShare({ ownerAddress: 'Ximported', amountDuffs: dash(300), keyIndex: null, imported: true })
    const external = makeShare({ ownerAddress: 'Xexternal', amountDuffs: dash(500), keyIndex: null, imported: false })

    expect(isOwnedShare(derived)).toBe(true)
    expect(isOwnedShare(imported)).toBe(true)
    expect(isOwnedShare(external)).toBe(false)

    const summary = calculateShareSummary([derived, imported, external])
    expect(summary).toEqual({
      totalDuffs: dash(1000),
      ownedDuffs: dash(500),
      ownedCount: 2,
      totalCount: 3,
      ownedRatio: 0.5,
    })
    expect(formatOwnedShareStake(summary!)).toBe('500 / 1000 Dash (50%)')
  })

  it('computes fractional Evonode share percentages (250 Dash of 4000 Dash -> 6.25%)', () => {
    const shares = [
      makeShare({ ownerAddress: 'Xevo', amountDuffs: dash(250), keyIndex: 0 }),
      makeShare({ ownerAddress: 'Xrest', amountDuffs: dash(3750) }),
    ]

    const summary = calculateShareSummary(shares)
    expect(summary).toEqual({
      totalDuffs: dash(4000),
      ownedDuffs: dash(250),
      ownedCount: 1,
      totalCount: 2,
      ownedRatio: 0.0625,
    })
    expect(shareRatio(dash(250), dash(4000))).toBe(0.0625)
    expect(formatSharePercent(0.0625)).toBe('6.25%')
    expect(formatOwnedShareStake(summary!)).toBe('250 / 4000 Dash (6.25%)')
  })

  it('handles zero owned shares, zero total duffs, null shares, and empty shares', () => {
    const externalOnly = [
      makeShare({ ownerAddress: 'Xext1', amountDuffs: dash(400) }),
      makeShare({ ownerAddress: 'Xext2', amountDuffs: dash(600) }),
    ]

    const summary = calculateShareSummary(externalOnly)
    expect(summary).toEqual({
      totalDuffs: dash(1000),
      ownedDuffs: 0n,
      ownedCount: 0,
      totalCount: 2,
      ownedRatio: 0,
    })
    expect(formatSharePercent(0)).toBe('0%')
    expect(formatOwnedShareStake(summary!)).toBe('0 / 1000 Dash (0%)')

    expect(shareRatio(dash(100), 0n)).toBe(0)
    expect(calculateShareSummary(null)).toBeNull()
    expect(calculateShareSummary([])).toBeNull()
  })
})

describe('Node access display, roles, badges, and service formatting', () => {
  it('renders nodeAccessDisplay for shared nodes with owned shares (with and without voting key)', () => {
    const withVoting = makeNode({
      isShared: true,
      votingKeyIndex: 0,
      shares: [
        makeShare({ ownerAddress: 'Xwallet', amountDuffs: dash(500), keyIndex: 0 }),
        makeShare({ ownerAddress: 'Xext', amountDuffs: dash(500) }),
      ],
    })
    const withoutVoting = makeNode({
      isShared: true,
      votingKeyIndex: null,
      importedRoles: [],
      shares: [
        makeShare({ ownerAddress: 'Xderived', amountDuffs: dash(200), keyIndex: 1 }),
        makeShare({ ownerAddress: 'Ximported', amountDuffs: dash(300), imported: true }),
        makeShare({ ownerAddress: 'Xext', amountDuffs: dash(500) }),
      ],
    })
    const singleShareWithImportedVoting = makeNode({
      isShared: true,
      votingKeyIndex: null,
      importedRoles: ['voting'],
      shares: [
        makeShare({ ownerAddress: 'XsoloShare', amountDuffs: dash(1000), keyIndex: 0 }),
      ],
    })

    expect(nodeAccessDisplay(withVoting)).toEqual({
      primary: '500 / 1000 Dash (50%)',
      secondary: '1 of 2 shares · Voting',
    })
    expect(nodeAccessDisplay(withoutVoting)).toEqual({
      primary: '500 / 1000 Dash (50%)',
      secondary: '2 of 3 shares',
    })
    expect(nodeAccessDisplay(singleShareWithImportedVoting)).toEqual({
      primary: '1000 / 1000 Dash (100%)',
      secondary: '1 of 1 share · Voting',
    })
  })

  it('renders nodeAccessDisplay for shared nodes with zero owned shares', () => {
    const sharedWithVoting = makeNode({
      isShared: true,
      votingKeyIndex: 2,
      shares: [
        makeShare({ ownerAddress: 'Xext1', amountDuffs: dash(500) }),
        makeShare({ ownerAddress: 'Xext2', amountDuffs: dash(500) }),
      ],
    })
    const sharedWithImportedVoting = makeNode({
      ...sharedWithVoting,
      votingKeyIndex: null,
      importedRoles: ['voting'],
    })
    const sharedNoWalletKeys = makeNode({
      ...sharedWithVoting,
      votingKeyIndex: null,
      importedRoles: [],
    })

    expect(nodeAccessDisplay(sharedWithVoting)).toEqual({
      primary: 'Voting',
      secondary: '0 of 2 shares · In this wallet',
    })
    expect(nodeAccessDisplay(sharedWithImportedVoting)).toEqual({
      primary: 'Voting',
      secondary: '0 of 2 shares · Imported key',
    })
    expect(nodeAccessDisplay(sharedNoWalletKeys)).toEqual({
      primary: 'Collateral',
      secondary: '0 of 2 shares · Outside this wallet',
    })
  })

  it('renders nodeAccessDisplay for shared nodes with null shares', () => {
    const sharedNullSharesWalletVoting = makeNode({
      isShared: true,
      shares: null,
      votingKeyIndex: 0,
    })
    const sharedNullSharesImported = makeNode({
      isShared: true,
      shares: null,
      votingKeyIndex: null,
      importedRoles: ['owner', 'voting'],
    })
    const sharedNullSharesExternal = makeNode({
      isShared: true,
      shares: null,
      votingKeyIndex: null,
      importedRoles: [],
    })

    expect(nodeAccessDisplay(sharedNullSharesWalletVoting)).toEqual({
      primary: 'Voting',
      secondary: 'Shared collateral · In this wallet',
    })
    expect(nodeAccessDisplay(sharedNullSharesImported)).toEqual({
      primary: 'Owner · Voting',
      secondary: 'Shared collateral · Imported key',
    })
    expect(nodeAccessDisplay(sharedNullSharesExternal)).toEqual({
      primary: 'Collateral',
      secondary: 'Shared collateral · Outside this wallet',
    })
  })

  it('renders nodeAccessDisplay and role labels for solo nodes', () => {
    const allRoles = makeNode({
      isShared: false,
      ownerKeyIndex: 0,
      operatorKeyIndex: 1,
      votingKeyIndex: 2,
    })
    const importedVotingOnly = makeNode({
      isShared: false,
      ownerKeyIndex: null,
      operatorKeyIndex: null,
      votingKeyIndex: null,
      importedRoles: ['voting'],
    })
    const collateralOnly = makeNode({
      isShared: false,
      ownerKeyIndex: null,
      operatorKeyIndex: null,
      votingKeyIndex: null,
      importedRoles: [],
    })

    expect(nodeWalletRoles(allRoles)).toEqual(['owner', 'operator', 'voting'])
    expect(nodeRolesLabel(allRoles)).toBe('Owner · Operator · Voting')
    expect(nodeVotingAccessLabel(allRoles)).toBe('In this wallet')
    expect(nodeAccessDisplay(allRoles)).toEqual({
      primary: 'Owner · Operator · Voting',
      secondary: 'In this wallet',
    })

    expect(nodeVotingAccessLabel(importedVotingOnly)).toBe('Imported key')
    expect(nodeAccessDisplay(importedVotingOnly)).toEqual({
      primary: 'Voting',
      secondary: 'Imported key',
    })

    expect(nodeRolesLabel(collateralOnly)).toBe('Collateral')
    expect(nodeVotingAccessLabel(collateralOnly)).toBe('Outside this wallet')
    expect(nodeAccessDisplay(collateralOnly)).toEqual({
      primary: 'Collateral',
      secondary: 'Outside this wallet',
    })
  })

  it('resolves shareOriginBadge, keyOriginBadge, and role checks', () => {
    expect(shareOriginBadge(makeShare({ keyIndex: 0, imported: false }))).toEqual({
      variant: 'accent',
      text: 'Wallet key',
    })
    expect(shareOriginBadge(makeShare({ keyIndex: null, imported: true }))).toEqual({
      variant: 'accent',
      text: 'Imported',
    })
    expect(shareOriginBadge(makeShare({ keyIndex: null, imported: false }))).toEqual({
      variant: 'muted',
      text: 'External',
    })

    const mixedRoleNode = makeNode({
      ownerKeyIndex: 0,
      votingKeyIndex: null,
      operatorKeyIndex: null,
      importedRoles: ['voting'],
    })

    const shareOwnedOnly = makeNode({
      ownerKeyIndex: null,
      votingKeyIndex: null,
      operatorKeyIndex: null,
      importedRoles: [],
      isShared: true,
      shares: [makeShare({ keyIndex: 0 })],
    })

    expect(hasRoleInWallet(mixedRoleNode, 'owner')).toBe(true)
    expect(hasRoleInWallet(mixedRoleNode, 'voting')).toBe(true)
    expect(hasRoleInWallet(mixedRoleNode, 'operator')).toBe(false)
    expect(hasRoleInWallet(shareOwnedOnly, 'owner')).toBe(true)

    expect(keyOriginBadge(mixedRoleNode, 'owner')).toEqual({ variant: 'accent', text: 'Wallet key' })
    expect(keyOriginBadge(mixedRoleNode, 'voting')).toEqual({ variant: 'accent', text: 'Imported' })
    expect(keyOriginBadge(mixedRoleNode, 'operator')).toEqual({ variant: 'muted', text: 'External' })
  })

  it('formats serviceAddress for null, blank, unassigned 0.0.0.0:0, and valid addresses', () => {
    expect(formatServiceAddress(null)).toBe('Unassigned')
    expect(formatServiceAddress('')).toBe('Unassigned')
    expect(formatServiceAddress('   ')).toBe('Unassigned')
    expect(formatServiceAddress('0.0.0.0:0')).toBe('Unassigned')
    expect(formatServiceAddress('127.0.0.1:9999')).toBe('127.0.0.1:9999')
  })
})

describe('emptyNodesDescription', () => {
  it('shows P2P sync copy only while P2P discovery has not completed', () => {
    expect(emptyNodesDescription('p2p', false)).toBe(NODES_TAB_COPY.p2pSyncing)
    expect(emptyNodesDescription('p2p', true)).toBe(NODES_TAB_COPY.emptyDescription)
  })

  it('shows the RPC-specific empty description regardless of discovery state', () => {
    expect(emptyNodesDescription('rpc', false)).toBe(NODES_TAB_COPY.rpcEmptyDescription)
    expect(emptyNodesDescription('rpc', true)).toBe(NODES_TAB_COPY.rpcEmptyDescription)
  })

  it('keeps P2P syncing, P2P empty, and RPC empty copy distinct', () => {
    expect(new Set([
      NODES_TAB_COPY.p2pSyncing,
      NODES_TAB_COPY.emptyDescription,
      NODES_TAB_COPY.rpcEmptyDescription,
    ]).size).toBe(3)
  })
})

describe('importedKeyStatusMessage', () => {
  it('explains P2P switching only when an RPC owner key matches zero nodes', () => {
    expect(importedKeyStatusMessage([], 'rpc', 'owner')).toBe(MANAGE_KEYS_COPY.keySavedForP2PNotice)
    expect(MANAGE_KEYS_COPY.keySavedForP2PNotice).not.toBe(MANAGE_KEYS_COPY.keyImportedNotice)
  })

  it('reports matched node counts in RPC mode when owner matches nodes or for non-owner roles', () => {
    expect(importedKeyStatusMessage([regularNode], 'rpc', 'owner')).toBe(
      'Masternode key imported (1 node matched)',
    )
    expect(importedKeyStatusMessage([regularNode, otherNode], 'rpc', 'owner')).toBe(
      'Masternode key imported (2 nodes matched)',
    )
    expect(importedKeyStatusMessage([], 'rpc', 'voting')).toBe(
      'Masternode key imported (0 nodes matched)',
    )
    expect(importedKeyStatusMessage([], 'rpc', 'operator')).toBe(
      'Masternode key imported (0 nodes matched)',
    )
    expect(importedKeyStatusMessage([regularNode], 'rpc', 'voting')).toBe(
      'Masternode key imported (1 node matched)',
    )
    expect(importedKeyStatusMessage([regularNode, otherNode], 'rpc', 'operator')).toBe(
      'Masternode key imported (2 nodes matched)',
    )
  })

  it('reports matched node counts in P2P mode for all roles including zero matches', () => {
    const roles: MasternodeKeyRole[] = ['owner', 'voting', 'operator']
    for (const role of roles) {
      expect(importedKeyStatusMessage([], 'p2p', role)).toBe(
        'Masternode key imported (0 nodes matched)',
      )
      expect(importedKeyStatusMessage([regularNode], 'p2p', role)).toBe(
        'Masternode key imported (1 node matched)',
      )
      expect(importedKeyStatusMessage([regularNode, otherNode], 'p2p', role)).toBe(
        'Masternode key imported (2 nodes matched)',
      )
    }
  })

  it('falls back to the generic import notice when matched nodes are null', () => {
    const modes: ConnectionType[] = ['p2p', 'rpc']
    const roles: MasternodeKeyRole[] = ['owner', 'voting', 'operator']
    for (const mode of modes) {
      for (const role of roles) {
        expect(importedKeyStatusMessage(null, mode, role)).toBe(MANAGE_KEYS_COPY.keyImportedNotice)
      }
    }
  })
})

describe('Masternode action guards', () => {
  it('allows registrar updates and operator actions on solo nodes with derived key index 0', () => {
    const soloDerived = makeNode({
      isShared: false,
      shares: [],
      ownerKeyIndex: 0,
      operatorKeyIndex: 0,
    })

    expect(canUpdateNodeRegistrar(soloDerived)).toBe(true)
    expect(updateRegistrarDisabledReason(soloDerived)).toBeUndefined()
    expect(canOperateNode(soloDerived)).toBe(true)
    expect(operateNodeDisabledReason(soloDerived)).toBeUndefined()
  })

  it('blocks registrar updates and operator actions on shared nodes even when ownerKeyIndex and operatorKeyIndex are 0', () => {
    const sharedWithKeys = makeNode({
      isShared: true,
      shares: [makeShare({ ownerAddress: 'Xshare1', keyIndex: 0 })],
      ownerKeyIndex: 0,
      operatorKeyIndex: 0,
    })
    const sharedViaSharesOnly = makeNode({
      isShared: false,
      shares: [makeShare({ ownerAddress: 'Xshare2', keyIndex: 0 })],
      ownerKeyIndex: 0,
      operatorKeyIndex: 0,
    })
    const sharedRpcWithoutKeys = makeNode({
      isShared: true,
      shares: null,
      ownerKeyIndex: null,
      operatorKeyIndex: null,
    })

    for (const node of [sharedWithKeys, sharedViaSharesOnly, sharedRpcWithoutKeys]) {
      expect(canUpdateNodeRegistrar(node)).toBe(false)
      expect(updateRegistrarDisabledReason(node)).toBe(NODE_DETAIL_COPY.sharedUpdateRegistrarUnsupported)
      expect(canOperateNode(node)).toBe(false)
      expect(operateNodeDisabledReason(node)).toBe(NODE_DETAIL_COPY.sharedOperatorUnsupported)
    }
  })

  it('blocks registrar updates and operator actions on solo nodes missing derived keys, including imported-only roles', () => {
    const soloNoKeys = makeNode({
      isShared: false,
      shares: null,
      ownerKeyIndex: null,
      operatorKeyIndex: null,
      importedRoles: [],
    })
    const soloImportedOnly = makeNode({
      isShared: false,
      shares: [],
      ownerKeyIndex: null,
      operatorKeyIndex: null,
      importedRoles: ['owner', 'operator'],
    })

    for (const node of [soloNoKeys, soloImportedOnly]) {
      expect(canUpdateNodeRegistrar(node)).toBe(false)
      expect(updateRegistrarDisabledReason(node)).toBe(NODE_DETAIL_COPY.ownerKeyRequired)
      expect(canOperateNode(node)).toBe(false)
      expect(operateNodeDisabledReason(node)).toBe(NODE_DETAIL_COPY.operatorKeyRequired)
    }

    const ownerOnly = makeNode({
      isShared: false,
      ownerKeyIndex: 0,
      operatorKeyIndex: null,
    })
    expect(canUpdateNodeRegistrar(ownerOnly)).toBe(true)
    expect(updateRegistrarDisabledReason(ownerOnly)).toBeUndefined()
    expect(canOperateNode(ownerOnly)).toBe(false)
    expect(operateNodeDisabledReason(ownerOnly)).toBe(NODE_DETAIL_COPY.operatorKeyRequired)

    const operatorOnly = makeNode({
      isShared: false,
      ownerKeyIndex: null,
      operatorKeyIndex: 0,
    })
    expect(canUpdateNodeRegistrar(operatorOnly)).toBe(false)
    expect(updateRegistrarDisabledReason(operatorOnly)).toBe(NODE_DETAIL_COPY.ownerKeyRequired)
    expect(canOperateNode(operatorOnly)).toBe(true)
    expect(operateNodeDisabledReason(operatorOnly)).toBeUndefined()
  })
})

describe('Masternode action builders', () => {
  const txid = 'a'.repeat(64)

  it('includes confirming and confirmed unspent coins matching exact collateral duffs and sorts confirmed first', () => {
    const coins = [
      { txid, vout: 2, address: 'X3', satoshis: 100_000_000_000n, height: 0, timestamp: null, confirmations: 0, isLocked: false, collateral: false },
      { txid, vout: 1, address: 'X2', satoshis: 100_000_000_000n, height: 100, timestamp: null, confirmations: 6, isLocked: false, collateral: true },
      { txid, vout: 0, address: 'X1', satoshis: 100_000_000_000n, height: 100, timestamp: null, confirmations: 6, isLocked: false, collateral: false },
      { txid, vout: 3, address: 'X4', satoshis: 400_000_000_000n, height: 100, timestamp: null, confirmations: 6, isLocked: false, collateral: false },
    ]
    const regular = eligibleCollateralUtxos(coins, 'Regular')
    expect(regular.map(coin => coin.vout)).toEqual([0, 2])
    expect(isConfirmingUtxo(regular[0]!)).toBe(false)
    expect(isConfirmingUtxo(regular[1]!)).toBe(true)
    expect(eligibleCollateralUtxos(coins, 'Evo').map(coin => coin.vout)).toEqual([3])
  })

  it('parses operator reward percentage into basis points and validates routable service endpoints', () => {
    expect(parseOperatorRewardBps('0')).toBe(0)
    expect(parseOperatorRewardBps('5.25')).toBe(525)
    expect(parseOperatorRewardBps('100')).toBe(10000)
    expect(parseOperatorRewardBps('100.01')).toBeNull()
    expect(isRoutableIpv4('45.67.89.10')).toBe(true)
    expect(isRoutableIpv4('127.0.0.1')).toBe(false)
    expect(isRoutableIpv4('192.168.1.5')).toBe(false)
    expect(isRoutableIpv4('203.0.113.10')).toBe(false)
    expect(splitIpPortInput('45.67.89.10:19999')).toEqual({ ip: '45.67.89.10', port: '19999' })
    expect(splitIpPortInput('45.67.89.10')).toEqual({ ip: '45.67.89.10', port: null })
    expect(validateServiceEndpoint('45.67.89.10:9999', 'mainnet').error).toBeNull()
    expect(validateServiceEndpoint('45.67.89.10:19999', 'mainnet').error).toContain('9999')
    expect(validateServiceEndpoint('45.67.89.10:9999', 'testnet').error).toContain('9999')
    expect(validateServiceEndpoint('127.0.0.1:9999', 'mainnet').error).toContain('routable')
    expect(validateServiceEndpoint('203.0.113.10:9999', 'mainnet').error).toContain('routable')
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
      ownerAddress: null,
      votingAddress: null,
      operatorPublicKey: null,
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
      serviceAddress: '45.67.89.10:19999',
      operatorPayoutAddress: '',
      platformNodeId: 'b'.repeat(40),
      platformP2PPort: '26656',
      platformHttpPort: '1443',
      network: 'testnet',
    })
    expect(updSrv.error).toBeNull()
    expect(updSrv.dto?.platformP2PPort).toBe(26656)
  })

  it('validates multi-step registration wizard fields, DIP-3 key collisions, and pending list status', () => {
    const payoutAddr = PrivateKey.fromBytes(Uint8Array.from({ length: 32 }, (_, i) => i + 1), 'testnet', true).getAddress()
    const ownerAddr = PrivateKey.fromBytes(Uint8Array.from({ length: 32 }, (_, i) => i + 2), 'testnet', true).getAddress()
    const collateralCoin = {
      txid,
      vout: 0,
      address: payoutAddr,
      satoshis: 400_000_000_000n,
      height: 0,
      timestamp: null,
      confirmations: 0,
      isLocked: false,
      collateral: false,
    }
    const baseDraft: RegisterWizardDraft = {
      type: 'Evo',
      collateralSource: 'wallet',
      selectedCollateral: `${txid}:0`,
      manualTxid: '',
      manualVout: '0',
      feeSourceMode: 'auto',
      feeSourceAddress: '',
      payoutAddress: payoutAddr,
      ownerMode: 'wallet',
      ownerAddress: '',
      votingMode: 'wallet',
      votingAddress: '',
      operatorMode: 'wallet',
      operatorPublicKey: '',
      operatorRewardPercent: '5',
      operatorPayoutAddress: '',
      serviceMode: 'now',
      serviceIp: '45.67.89.10',
      servicePort: '19999',
      platformNodeId: 'c'.repeat(40),
      platformP2PPort: '36656',
      platformHttpPort: '1443',
    }

    const ok = validateRegistrationWizard(baseDraft, [collateralCoin], [collateralCoin], 'testnet')
    expect(ok.step1Error).toBeNull()
    expect(ok.step2Error).toBeNull()
    expect(ok.step3Error).toBeNull()
    expect(ok.customKeyRoles).toEqual([])
    expect(ok.dto?.type).toBe('Evo')
    expect(ok.dto?.serviceAddress).toBe('45.67.89.10:19999')

    const sameOwner = validateRegistrationWizard(
      { ...baseDraft, ownerMode: 'external', ownerAddress: payoutAddr },
      [collateralCoin],
      [collateralCoin],
      'testnet',
    )
    expect(sameOwner.step2Error).toContain('owner')
    expect(sameOwner.customKeyRoles).toEqual(['Owner'])

    const customOwnerDiff = validateRegistrationWizard(
      { ...baseDraft, ownerMode: 'external', ownerAddress: ownerAddr },
      [collateralCoin],
      [collateralCoin],
      'testnet',
    )
    expect(customOwnerDiff.step2Error).toBeNull()
    expect(customOwnerDiff.customKeyRoles).toEqual(['Owner'])
    expect(customOwnerDiff.dto?.ownerAddress).toBe(ownerAddr)

    const pendingNode = makeNode({
      proTxHash: '00'.repeat(32),
      status: REGISTERING_MASTERNODE_STATUS,
      votingKeyIndex: null,
    })
    expect(masternodeStatus(REGISTERING_MASTERNODE_STATUS)).toEqual({ tone: StatusPillTone.Warning, label: 'Registering' })
    expect(nodeAccessDisplay(pendingNode)).toEqual({
      primary: NODE_DETAIL_COPY.pendingRegistrationPrimary,
      secondary: NODE_DETAIL_COPY.pendingRegistrationSecondary,
    })
    expect(filterNodes([regularNode, pendingNode], '', NodeSegment.All).map(n => n.proTxHash)).toEqual([
      pendingNode.proTxHash,
      regularNode.proTxHash,
    ])
    expect(filterNodes([regularNode, pendingNode], '', NodeSegment.Issues)).toEqual([])
    expect(classifyVotingMasternodes([pendingNode]).ineligible[0]?.reason).toBe('Awaiting block confirmation')
  })
})
