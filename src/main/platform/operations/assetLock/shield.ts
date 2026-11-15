import {OrchardAddressWASM, ShieldedMemoWASM} from 'pshenmic-dpp'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {buildAssetLockProof} from '../assetLockProof'
import {deriveCreditKey} from '../creditKey'
import {SHIELD_FUNDING_DUMMY_OUTPUTS} from '../../../src/constants/fee/platform'
import {SHIELDED_ACCOUNT} from '../../../src/constants/addresses'

type Payload = PlatformOperations['shieldFromAssetLock']['payload']
type Result = PlatformOperations['shieldFromAssetLock']['result']

export async function shieldFromAssetLock(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, txid, outputIndex} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const privateKey = await deriveCreditKey(sdk, hdKey, network, payload.creditDerivationPath)
  const senderOvk = sdk.keyPair.deriveShieldedOutgoingViewingKey(seed, network, SHIELDED_ACCOUNT)

  ctx.progress('proving', 0, 0)
  const stateTransition = await sdk.shielded.createStateTransition('shieldFromAssetLock', {
    recipient: OrchardAddressWASM.fromBech32m(payload.recipient),
    shieldAmount: payload.shieldAmountCredits,
    assetLockProof: buildAssetLockProof(payload.assetLockProof, txid, outputIndex),
    privateKey,
    memo: ShieldedMemoWASM.empty() as unknown as string,
    dummyOutputs: SHIELD_FUNDING_DUMMY_OUTPUTS,
    senderOvk,
    platformVersion: await ctx.sdk.node.getProtocolVersion(),
    ...(payload.surplusAddress != null ? {surplusOutput: payload.surplusAddress} : {}),
  })

  return {stHash: await broadcast(sdk, stateTransition, ctx, {idempotent: true})}
}
