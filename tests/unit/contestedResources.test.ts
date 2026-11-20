import {describe, expect, it, vi} from 'vitest'
import {base64} from '@scure/base'
import {DashPlatformSDK} from 'dash-platform-sdk'
import {ContestedStateResultType} from 'dash-platform-sdk/types.js'
import stringToIndexValueBytes from 'dash-platform-sdk/src/utils/stringToIndexValueBytes.js'
import {contestedResources} from '../../src/main/platform/operations/governance/contestedResources'
import {OperationContext} from '../../src/main/platform/operations/types'

const CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
const PARENT = base64.encode(stringToIndexValueBytes('dash'))
const LABEL = base64.encode(stringToIndexValueBytes('owl'))

const poll = {contractId: {base58: () => CONTRACT_ID}, documentTypeName: 'domain', indexName: 'parentNameAndLabel', indexValues: [PARENT, LABEL]}

function context(overrides: {polls?: unknown[]; state?: unknown} = {}): {sdk: DashPlatformSDK; ctx: OperationContext} {
  const sdk = {
    contestedResources: {
      getVotePollsByEndDate: vi.fn(async () => [{timestampMs: 5_000n, votePolls: overrides.polls ?? [poll]}]),
      getContestedResourceVoteState: vi.fn(async () => overrides.state ?? {
        contenders: [{identifier: {base58: () => 'contender'}, voteTally: 4}],
        abstainVoteTally: 2,
        lockVoteTally: 1,
        finishedVoteInfo: undefined,
      }),
    },
    dataContracts: {getDataContractByIdentifier: vi.fn(async () => ({id: CONTRACT_ID}))},
  } as unknown as DashPlatformSDK
  return {
    sdk,
    ctx: {
      sdk,
      network: 'testnet',
      signal: new AbortController().signal,
      progress: () => undefined,
      notesSpent: () => undefined,
    },
  }
}

describe('listing contested resources', () => {
  it('enumerates open polls and reads each tally, decoding the index values', async () => {
    const {sdk, ctx} = context()

    const {resources} = await contestedResources({}, ctx)

    expect(sdk.contestedResources.getVotePollsByEndDate).toHaveBeenCalledWith(
      {timeMs: expect.any(BigInt), included: true}, undefined, 100,
    )
    expect(sdk.contestedResources.getContestedResourceVoteState).toHaveBeenCalledWith(
      {id: CONTRACT_ID}, 'domain', 'parentNameAndLabel',
      [stringToIndexValueBytes('dash'), stringToIndexValueBytes('owl')],
      ContestedStateResultType.DOCUMENTS_AND_VOTE_TALLY, true,
    )
    expect(resources).toEqual([{
      contractId: CONTRACT_ID,
      documentTypeName: 'domain',
      indexName: 'parentNameAndLabel',
      indexValues: [PARENT, LABEL],
      endsAt: 5_000,
      vote: {
        contenders: [{identifier: 'contender', votes: 4}],
        lockVotes: 1,
        abstainVotes: 2,
        outcome: null,
        winner: null,
      },
    }])
  })

  it('maps a finished poll to its outcome and winner', async () => {
    const {ctx} = context({
      state: {
        contenders: [{identifier: {base58: () => 'winner'}}],
        abstainVoteTally: 0,
        lockVoteTally: 0,
        finishedVoteInfo: {type: 'WonByIdentity', wonByIdentityId: {base58: () => 'winner'}},
      },
    })

    const {resources} = await contestedResources({}, ctx)

    expect(resources[0].vote).toMatchObject({outcome: 'WonByIdentity', winner: 'winner'})
  })

  // Drive returns polls grouped by end date; one contract read serves them all.
  it('fetches a contract once for its several polls', async () => {
    const second = {...poll, indexValues: [PARENT, base64.encode(stringToIndexValueBytes('cat'))]}
    const {sdk, ctx} = context({polls: [poll, second]})

    const {resources} = await contestedResources({}, ctx)

    expect(resources).toHaveLength(2)
    expect(sdk.dataContracts.getDataContractByIdentifier).toHaveBeenCalledTimes(1)
  })
})