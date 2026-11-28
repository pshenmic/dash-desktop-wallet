import {base64} from '@scure/base'
import {ContestedStateResultType} from 'dash-platform-sdk/types.js'
import type {DataContractWASM} from 'pshenmic-dpp'
import {ContestedResource, ContestedResourceOutcome, ContestedResourceVote} from '../../../src/types/Governance'
import {PROVED_QUERY_LIMIT} from '../../constants'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, throwIfAborted} from '../types'
import {textIndexValue} from './indexValue'

type Payload = PlatformOperations['contestedResources']['payload']
type Result = PlatformOperations['contestedResources']['result']

type Poll = Omit<ContestedResource, 'vote'>

// Drive has no endpoint that lists contested resources themselves: its vote
// polls grouped by end date are the enumeration, and each poll's state is a
// second read that carries the contenders and the tallies.
export async function contestedResources(_payload: Payload, ctx: OperationContext): Promise<Result> {
  const polls = await openPolls(ctx)

  // A page of polls can name the same contract many times, so fetch it once.
  const contracts = new Map<string, Promise<DataContractWASM>>()
  const contractFor = (identifier: string): Promise<DataContractWASM> => {
    const known = contracts.get(identifier)
    if (known != null) return known
    const fetched = ctx.sdk.dataContracts.getDataContractByIdentifier(identifier)
    contracts.set(identifier, fetched)
    return fetched
  }

  return {
    resources: await Promise.all(polls.map(async poll => ({...poll, vote: await voteOf(poll, contractFor, ctx)}))),
  }
}

// Every poll whose end date is still ahead, oldest first.
async function openPolls({sdk, signal}: OperationContext): Promise<Poll[]> {
  const polls = new Map<string, Poll>()
  let start = BigInt(Date.now())
  for (;;) {
    const groups = await sdk.contestedResources.getVotePollsByEndDate({timeMs: start, included: true}, undefined, PROVED_QUERY_LIMIT)
    throwIfAborted(signal)

    for (const group of groups) {
      for (const poll of group.votePolls) {
        const entry = {
          contractId: poll.contractId.base58(),
          documentTypeName: poll.documentTypeName,
          indexName: poll.indexName,
          indexValues: poll.indexValues,
          indexValuesText: poll.indexValues.map(value => textIndexValue(base64.decode(value))),
          endsAt: Number(group.timestampMs),
        }
        polls.set(`${entry.contractId}:${entry.documentTypeName}:${entry.indexName}:${entry.indexValues.join(',')}`, entry)
      }
    }

    // Polls sharing an end time can straddle a page, so the next page starts at
    // it; a page that adds nothing new must not loop on the same timestamp.
    const found = groups.reduce((total, group) => total + group.votePolls.length, 0)
    const last = groups.at(-1)?.timestampMs
    if (found < PROVED_QUERY_LIMIT || last == null || last === start) break
    start = last
  }
  return [...polls.values()]
}

async function voteOf(
  poll: Poll,
  contractFor: (identifier: string) => Promise<DataContractWASM>,
  {sdk}: OperationContext,
): Promise<ContestedResourceVote> {
  const contract = await contractFor(poll.contractId)
  const state = await sdk.contestedResources.getContestedResourceVoteState(
    contract, poll.documentTypeName, poll.indexName,
    // A poll carries its index values base64-encoded; the query wants the bytes.
    poll.indexValues.map(value => base64.decode(value)),
    ContestedStateResultType.DOCUMENTS_AND_VOTE_TALLY, true,
  )
  const finished = state.finishedVoteInfo

  return {
    // The SDK types the tally as `voteCount` but returns it as `voteTally`.
    contenders: state.contenders.map(contender => ({
      identifier: contender.identifier.base58(),
      votes: (contender as {voteTally?: number}).voteTally ?? 0,
    })),
    lockVotes: state.lockVoteTally ?? 0,
    abstainVotes: state.abstainVoteTally ?? 0,
    outcome: (finished?.type as ContestedResourceOutcome | undefined) ?? null,
    winner: finished?.wonByIdentityId?.base58() ?? null,
  }
}