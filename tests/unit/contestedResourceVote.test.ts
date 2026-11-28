import {describe, expect, it, vi} from 'vitest'
import {base64} from '@scure/base'
import {DashPlatformSDK} from 'dash-platform-sdk'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import stringToIndexValueBytes from 'dash-platform-sdk/src/utils/stringToIndexValueBytes.js'
import {contestedResourceVote} from '../../src/main/platform/operations/governance/vote'
import {OperationContext} from '../../src/main/platform/operations/types'

const SECRET = new Uint8Array(32).fill(3)
const PRO_TX_HASH = 'ab'.repeat(32)
const CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
const ST_HASH = 'st-hash'
const VALUES = ['dash', 'owl'].map(value => base64.encode(stringToIndexValueBytes(value)))

function context(): {
  sdk: DashPlatformSDK
  ctx: OperationContext
  sign: ReturnType<typeof vi.fn>
  createVote: ReturnType<typeof vi.fn>
  createStateTransition: ReturnType<typeof vi.fn>
} {
  const key = PrivateKeyWASM.fromBytes(SECRET, 'testnet')
  const publicKey = {getPublicKeyHash: () => key.getPublicKeyHash(), disabledAt: undefined}
  const sign = vi.fn()
  const createVote = vi.fn(() => 'vote')
  const createStateTransition = vi.fn(() => ({sign, hash: () => ST_HASH}))
  const sdk = {
    voting: {createVoterIdentityId: vi.fn(async () => 'voter-id'), createVote, createStateTransition},
    identities: {
      getIdentityByIdentifier: vi.fn(async () => ({id: 'voter-id', getPublicKeys: () => [publicKey]})),
      getIdentityNonce: vi.fn(async () => 7n),
    },
    stateTransitions: {
      broadcast: vi.fn(async () => undefined),
      waitForStateTransitionResult: vi.fn(async () => undefined),
    },
  } as unknown as DashPlatformSDK
  return {
    sdk,
    sign,
    createVote,
    createStateTransition,
    ctx: {
      sdk,
      network: 'testnet',
      signal: new AbortController().signal,
      progress: () => undefined,
      notesSpent: () => undefined,
    },
  }
}

const payload = (overrides: {indexValues?: string[]; choice?: unknown} = {}) => ({
  votingKey: SECRET,
  proTxHash: PRO_TX_HASH,
  contractId: CONTRACT_ID,
  documentTypeName: 'domain',
  indexName: 'parentNameAndLabel',
  indexValues: overrides.indexValues ?? VALUES,
  choice: overrides.choice ?? {kind: 'towardsIdentity', identifier: 'contender'},
}) as never

describe('voting on a contested resource', () => {
  it('builds the next-nonce vote and signs it with the voting key', async () => {
    const {sdk, ctx, sign, createVote, createStateTransition} = context()

    const result = await contestedResourceVote(payload(), ctx)

    expect(result).toEqual({stHash: ST_HASH})
    expect(sdk.voting.createVoterIdentityId).toHaveBeenCalledWith(PRO_TX_HASH, expect.any(String))
    expect(createVote).toHaveBeenCalledWith(CONTRACT_ID, 'domain', 'parentNameAndLabel', ['dash', 'owl'], 'contender')
    expect(createStateTransition).toHaveBeenCalledWith('vote', PRO_TX_HASH, 'voter-id', 8n)
    expect(sign).toHaveBeenCalledTimes(1)
    expect(Buffer.from(sign.mock.calls[0][0].bytes())).toEqual(Buffer.from(SECRET))
    expect(sign.mock.calls[0][1]).toMatchObject({disabledAt: undefined})
  })

  it('maps lock and abstain choices to their SDK spelling', async () => {
    const {ctx, createVote} = context()

    await contestedResourceVote(payload({choice: {kind: 'lock'}}), ctx)

    expect(createVote).toHaveBeenCalledWith(CONTRACT_ID, 'domain', 'parentNameAndLabel', ['dash', 'owl'], 'lock')
  })

  it('refuses a poll whose index values are not text', async () => {
    const {ctx} = context()
    const raw = base64.encode(new Uint8Array([1, 2, 3]))

    await expect(contestedResourceVote(payload({indexValues: [raw]}), ctx)).rejects.toThrow('text index values')
  })
})