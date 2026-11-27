import {describe, it, expect, vi} from 'vitest'
import {base64} from '@scure/base'
import stringToIndexValueBytes from 'dash-platform-sdk/src/utils/stringToIndexValueBytes.js'
import {DPNS_DATA_CONTRACT_ID} from 'dash-platform-sdk/src/constants.js'

const stub = vi.hoisted(() => ({contest: vi.fn()}))

vi.mock('../../src/main/platform/operations/username/status', () => ({contest: stub.contest}))

import {usernameContests} from '../../src/main/platform/operations/username/contests'
import {OperationContext} from '../../src/main/platform/operations/types'
import {DPNS_CONTESTED_INDEX} from '../../src/main/platform/constants'

const indexValue = (value: string): string => base64.encode(stringToIndexValueBytes(value))

const domainPoll = {
  kind: 'contestedDocumentResourceVotePoll',
  contractId: {base58: () => DPNS_DATA_CONTRACT_ID},
  documentTypeName: 'domain',
  indexName: DPNS_CONTESTED_INDEX,
  indexValues: [indexValue('dash'), indexValue('alice')],
}

const yesNoPoll = {
  kind: 'yesNoVotePoll',
  get contractId(): never {
    throw new Error('this vote poll is a yes/no vote poll, not a contested document resource vote poll')
  },
}

const context = (groups: unknown[]): OperationContext => ({
  sdk: {contestedResources: {getVotePollsByEndDate: vi.fn().mockResolvedValue(groups)}},
  network: 'testnet',
  signal: new AbortController().signal,
  progress: () => undefined,
  notesSpent: () => undefined,
} as unknown as OperationContext)

describe('username contests', () => {
  it('ignores decision-proposal polls sharing the end-time index', async () => {
    stub.contest.mockResolvedValue({contenders: [{identifier: 'identity-a'}]})

    const result = await usernameContests(
      {identifiers: ['identity-a']},
      context([{timestampMs: 1_760_000_000_000, votePolls: [yesNoPoll, domainPoll]}]),
    )

    expect(result.contests).toEqual([{identifier: 'identity-a', label: 'alice'}])
    expect(stub.contest).toHaveBeenCalledWith(expect.anything(), 'alice')
  })
})
