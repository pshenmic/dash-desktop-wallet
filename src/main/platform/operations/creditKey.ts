import {DashPlatformSDK} from 'dash-platform-sdk'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {Network} from '../../src/types/Network'
import {OperationError} from './types'

type HdKey = ReturnType<DashPlatformSDK['keyPair']['seedToHdKey']>

// The key that owns the asset lock's credit output, at the funding path the
// funding row recorded.
export async function deriveCreditKey(
  sdk: DashPlatformSDK,
  hdKey: HdKey,
  network: Network,
  creditDerivationPath: string,
): Promise<PrivateKeyWASM> {
  const derived = await sdk.keyPair.derivePath(hdKey, creditDerivationPath)
  if (!derived.privateKey) throw new OperationError('Failed to derive the asset lock credit key', 'internal')
  return PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)
}
