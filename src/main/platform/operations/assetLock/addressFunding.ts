import {
  AddressFundingFromAssetLockTransitionWASM,
  AddressFundsFeeStrategyStepWASM,
  OutputAddressNullableCreditsWASM,
} from 'dash-platform-sdk/types.js'
import {PlatformAddressWASM} from 'pshenmic-dpp'
import {compareAddressBytes} from '../../../src/utils/addressOrder'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {buildAssetLockProof} from '../assetLockProof'
import {deriveCreditKey} from '../creditKey'

type Payload = PlatformOperations['addressFundingFromAssetLock']['payload']
type Result = PlatformOperations['addressFundingFromAssetLock']['result']

export async function addressFundingFromAssetLock(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, txid, outputIndex} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const creditKey = await deriveCreditKey(sdk, hdKey, network, payload.creditDerivationPath)

  // ReduceOutput is positional over the outputs in address byte order.
  const recipientBytes = PlatformAddressWASM.fromBech32m(payload.recipient).bytes()
  const remainderBytes = PlatformAddressWASM.fromBech32m(payload.remainderAddress).bytes()
  const remainderIndex = compareAddressBytes(remainderBytes, recipientBytes) < 0 ? 0 : 1

  ctx.progress('signing', 0, 0)
  const unsigned = sdk.platformAddresses.createStateTransition('addressFundingFromAssetLock', {
    assetLockProof: buildAssetLockProof(payload.assetLockProof, txid, outputIndex),
    inputs: [],
    feeStrategy: [AddressFundsFeeStrategyStepWASM.ReduceOutput(remainderIndex)],
    inputWitness: [],
    outputs: [
      new OutputAddressNullableCreditsWASM(payload.recipient, payload.recipientCredits),
      new OutputAddressNullableCreditsWASM(payload.remainderAddress),
    ],
    userFeeIncrease: 0,
  })

  const transition = AddressFundingFromAssetLockTransitionWASM.fromStateTransition(unsigned)
  transition.signature = creditKey.sign(unsigned.getSignableBytes())

  return {stHash: await broadcast(sdk, transition.toStateTransition(), ctx, {idempotent: true})}
}