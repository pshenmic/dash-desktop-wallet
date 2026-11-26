import {base64} from '@scure/base'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {textIndexValue} from './indexValue'

type Payload = PlatformOperations['contestedResourceVote']['payload']
type Result = PlatformOperations['contestedResourceVote']['result']

// The voter identity is derived from the node and its voting key, so that key
// must be one of the identity's keys. A vote is otherwise a signed transition.
export async function contestedResourceVote(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {votingKey, proTxHash, contractId, documentTypeName, indexName, indexValues, choice} = payload

  const indexValueTexts: string[] = []
  for (const value of indexValues) {
    const text = textIndexValue(base64.decode(value))
    if (text == null) throw new OperationError('This contest does not carry text index values, so this wallet cannot vote on it', 'internal')
    indexValueTexts.push(text)
  }

  const key = PrivateKeyWASM.fromBytes(votingKey, network)
  const keyHash = key.getPublicKeyHash()
  const voterId = await sdk.voting.createVoterIdentityId(proTxHash, keyHash)
  const voter = await sdk.identities.getIdentityByIdentifier(voterId)
  const publicKey = voter.getPublicKeys().find(candidate => candidate.getPublicKeyHash() === keyHash)
  if (publicKey == null) {
    throw new OperationError(`Masternode ${proTxHash} has no Platform voter key matching its voting key`, 'internal')
  }
  if (publicKey.disabledAt != null) {
    throw new OperationError(`Masternode ${proTxHash} has disabled its Platform voter key`, 'internal')
  }

  // One past the identity's nonce, which is what makes this transition the next
  // one Drive applies for this voter.
  const nonce = await sdk.identities.getIdentityNonce(voterId) + 1n
  const resourceChoice = choice.kind === 'towardsIdentity' ? choice.identifier : choice.kind
  const vote = sdk.voting.createVote(contractId, documentTypeName, indexName, indexValueTexts, resourceChoice)
  const st = sdk.voting.createStateTransition(vote, proTxHash, voter.id, nonce)

  ctx.progress('signing', 0, 0)
  st.sign(key, publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}