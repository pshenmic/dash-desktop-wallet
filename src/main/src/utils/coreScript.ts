import {CoreScriptWASM} from 'pshenmic-dpp'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {Network} from '../types/Network'
import {ADDRESS_DECODED_LENGTH, ADDRESS_PREFIX} from '../constants/addresses'

export type CoreAddressDecode = {type: 'p2pkh' | 'p2sh'; hash: Uint8Array} | 'invalid' | 'wrong-network'

export function decodeCoreAddress(address: string, network: Network): CoreAddressDecode {
  let decoded: Uint8Array
  try {
    decoded = Base58Check.decode(address)
  } catch {
    return 'invalid'
  }
  if (decoded.length !== ADDRESS_DECODED_LENGTH) return 'invalid'
  const prefixes = ADDRESS_PREFIX[network]
  const hash = decoded.slice(1)
  if (decoded[0] === prefixes.p2pkh) return {type: 'p2pkh', hash}
  if (decoded[0] === prefixes.p2sh) return {type: 'p2sh', hash}
  return 'wrong-network'
}

export function coreAddressToScript(coreAddress: string, network: Network): CoreScriptWASM {
  const decoded = decodeCoreAddress(coreAddress, network)
  if (decoded === 'invalid') throw new Error(`Invalid Core address: ${coreAddress}`)
  if (decoded === 'wrong-network') throw new Error(`Core address is not a valid ${network} address`)
  return decoded.type === 'p2pkh' ? CoreScriptWASM.newP2PKH(decoded.hash) : CoreScriptWASM.newP2SH(decoded.hash)
}
