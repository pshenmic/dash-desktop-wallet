import {describe, expect, it} from 'vitest'
import {bytesToHex, hexToBytes, utf8ToBytes} from '@noble/hashes/utils.js'
import {GovernanceObject, GovernanceObjectType, GovernanceVote as SDKGovernanceVote, OutPoint, PrivateKey, VoteOutcome, VoteSignal} from 'dash-core-sdk'
import {GovernanceVote} from '../../src/main/src/types/Governance'
import {Masternode, NetworkMasternode} from '../../src/main/src/types/Masternode'
import {
  governanceVote,
  isStaleProposal,
  lastVoteTime,
  proposalOf,
  proposalTally,
  requireVotingNode,
} from '../../src/main/src/utils/governance'
import {MAINNET_PROPOSAL_OBJECT, MAINNET_VOTES, TESTNET_VOTE} from '../fixtures/governance'

const PROPOSAL = 'a5465cdb6caf234cc9b8b776b1e3b60f319367504527e80a669bf41811419901'
const ZERO = '0'.repeat(32)

function node(collateralTxid: string, collateralVout: number, votingAddress: string, type = 'Regular'): NetworkMasternode {
  return {
    proTxHash: collateralTxid, type, status: 'ENABLED', posePenaltyScore: 0, collateralTxid, collateralVout,
    collateralAddress: null, serviceAddress: null, payeeAddress: null, ownerAddress: null, votingAddress,
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: null, lastPaidTime: null, registeredHeight: null,
  }
}

function vote(fields: Partial<GovernanceVote>): GovernanceVote {
  return {hash: 'h', collateralTxid: 'aa'.repeat(32), collateralVout: 0, parentHash: PROPOSAL, outcome: 1, signal: 1, time: 100, voter: 'Xvoter', ...fields}
}

const objectWithData = (data: string, type: GovernanceObjectType): GovernanceObject =>
  new GovernanceObject(ZERO, 1, 0, ZERO, data, type, new OutPoint(ZERO, 0xffffffff), '')

describe('governance objects', () => {
  it('hashes a mainnet proposal as Core does and reads its data', () => {
    const object = GovernanceObject.fromBytes(hexToBytes(MAINNET_PROPOSAL_OBJECT))
    expect(object.hash()).toBe(PROPOSAL)
    expect(proposalOf(object)).toEqual({
      hash: PROPOSAL,
      name: 'Dash-Pay-name-registration-rules',
      url: 'https://www.dashcentral.org/p/dashpay-name-reg-method',
      paymentAddress: 'XdWkmFKNosQvS1iPdof7SVme5Gd2GDsa62',
      paymentDuffs: 100_000_000n,
      startEpoch: 1798946946,
      endEpoch: 1801522426,
      createdAt: object.time,
      collateralHash: 'f64341933c383620eb01d3eb8dccebf6400490a03b1cf0a7d2700747d8a4163b',
    })
  })

  it('reads the data clients older than v0.14 wrapped in an array', () => {
    const fields = {name: 'old', url: 'u', payment_address: 'Xpay', payment_amount: 12.5, start_epoch: 1, end_epoch: 2}
    const data = bytesToHex(utf8ToBytes(JSON.stringify([['proposal', fields]])))
    expect(proposalOf(objectWithData(data, GovernanceObjectType.PROPOSAL))?.paymentDuffs).toBe(1_250_000_000n)
  })

  it('reads no proposal from a trigger or from data that is not one', () => {
    const data = bytesToHex(utf8ToBytes('{"event_block_height":1}'))
    expect(proposalOf(objectWithData(data, GovernanceObjectType.TRIGGER))).toBeNull()
    expect(proposalOf(objectWithData(data, GovernanceObjectType.PROPOSAL))).toBeNull()
  })

  it('counts a proposal stale once it ended before the current superblock cycle', () => {
    const now = 1_000_000_000
    expect(isStaleProposal({endEpoch: now - 3_600}, now, 'testnet')).toBe(false)
    expect(isStaleProposal({endEpoch: now - 3_601}, now, 'testnet')).toBe(true)
    expect(isStaleProposal({endEpoch: now - 3_601}, now, 'mainnet')).toBe(false)
  })
})

describe('governance votes', () => {
  it('reads a mainnet vote, its hash and the voting key that signed it', () => {
    expect(governanceVote(SDKGovernanceVote.fromBytes(hexToBytes(MAINNET_VOTES[0])), 'mainnet')).toEqual({
      hash: 'c6813959d49cb8c81cb0c3b9587af312cc90f0b4d86feb877dc1100754012eda',
      collateralTxid: 'd788faeb2a26cb60c8f607b9c2371c08f989edef528bea4d7dd3026aad199f14',
      collateralVout: 0,
      parentHash: PROPOSAL,
      outcome: 1,
      signal: 1,
      time: 1794224680,
      voter: 'Xumt2BNf5UYGhNvZkBUmeemy1xN8iLybrz',
    })
  })

  it('checks a testnet vote as a signed hash, not a message', () => {
    const parsed = governanceVote(SDKGovernanceVote.fromBytes(hexToBytes(TESTNET_VOTE)), 'testnet')
    expect(parsed).toMatchObject({
      collateralTxid: '4ee3ff5074723d995f4cb957a954587c6c637a42655ada8f4054037b28d1e7a8', collateralVout: 113,
      parentHash: 'c6f5059ca0055fb327a6a0b15b9dd80c64b8c0956c1621061b294f8b93edab7f', outcome: 3, signal: 1, time: 1792968939,
      voter: 'ycpPVZe1GUggvDT7secTBUinDJjXz9jW8J',
    })
    expect(governanceVote(SDKGovernanceVote.fromBytes(hexToBytes(MAINNET_VOTES[0])), 'testnet').voter).not.toBe('Xumt2BNf5UYGhNvZkBUmeemy1xN8iLybrz')
  })

  it.each(['mainnet', 'testnet'] as const)('signs a %s vote its voting key recovers from', network => {
    const key = PrivateKey.fromBytes(new Uint8Array(32).fill(9), network)
    const signed = new SDKGovernanceVote(new OutPoint('ab'.repeat(32), 3), PROPOSAL, VoteOutcome.NO, VoteSignal.FUNDING, 1_800_000_000)
    signed.sign(key, network)
    expect(governanceVote(signed, network)).toMatchObject({
      collateralTxid: 'ab'.repeat(32), collateralVout: 3, parentHash: PROPOSAL, outcome: 2, signal: 1, time: 1_800_000_000, voter: key.getAddress(),
    })
  })
})

describe('lastVoteTime', () => {
  it("is the node's latest funding vote its current voting key signed", () => {
    const listed = node('aa'.repeat(32), 0, 'Xvoter')
    expect(lastVoteTime([
      vote({time: 100}),
      vote({time: 300, voter: 'Xold'}),
      vote({time: 250, signal: 2}),
      vote({time: 200}),
      vote({time: 400, collateralVout: 1}),
    ], listed)).toBe(200)
    expect(lastVoteTime([], listed)).toBeNull()
  })
})

describe('requireVotingNode', () => {
  const TXID = 'aa'.repeat(32)
  const owned = (fields: Partial<Masternode> = {}): Masternode =>
    ({...node(TXID, 0, 'Xvoter'), ownerKeyIndex: null, votingKeyIndex: 2, operatorKeyIndex: null, importedRoles: [], ...fields})

  it('answers what signing the vote needs', () => {
    expect(requireVotingNode([owned()], TXID, [vote({time: 100})], 100 + 3600)).toEqual(
      {proTxHash: TXID, votingKeyIndex: 2, votingAddress: 'Xvoter', collateralTxid: TXID, collateralVout: 0})
    expect(requireVotingNode([owned()], TXID, null, 0).votingKeyIndex).toBe(2)
  })

  it('refuses a node Core would not let vote', () => {
    expect(() => requireVotingNode([], TXID, null, 0)).toThrow("not one of this wallet's")
    expect(() => requireVotingNode([owned({status: 'POSE_BANNED'})], TXID, null, 0)).toThrow('PoSe-banned')
    expect(() => requireVotingNode([owned({votingKeyIndex: null})], TXID, null, 0)).toThrow('does not derive')
    expect(() => requireVotingNode([owned({collateralTxid: null})], TXID, null, 0)).toThrow('no known collateral')
    expect(() => requireVotingNode([owned()], TXID, [vote({time: 100})], 100 + 3599)).toThrow('within the hour')
  })
})

describe('proposalTally', () => {
  const voter = 'Xvoter'

  it('weighs an evonode four times and skips a vote its node did not sign', () => {
    const tally = proposalTally([
      vote({collateralTxid: 'aa'.repeat(32), outcome: 1}),
      vote({collateralTxid: 'bb'.repeat(32), outcome: 2}),
      vote({collateralTxid: 'cc'.repeat(32), outcome: 3, voter: 'Xsomeone'}),
      vote({collateralTxid: 'dd'.repeat(32), outcome: 1}),
    ], [node('aa'.repeat(32), 0, voter, 'Evo'), node('bb'.repeat(32), 0, voter), node('cc'.repeat(32), 0, voter)])
    expect(tally).toEqual({yes: 4, no: 1, abstain: 0})
  })

  it("counts a node's latest funding vote only", () => {
    const tally = proposalTally([
      vote({outcome: 1, time: 200}),
      vote({outcome: 2, time: 100}),
      vote({outcome: 3, time: 300, signal: 2}),
    ], [node('aa'.repeat(32), 0, voter)])
    expect(tally).toEqual({yes: 1, no: 0, abstain: 0})
  })
})
