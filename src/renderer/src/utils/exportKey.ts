import { bytesToHex } from '@noble/hashes/utils.js'
import type { AddressKeyInfoDto } from '@renderer/api/types'
import type { FormattedAddressKey } from '@renderer/types/ExportKey'

export function formatAddressKey(info: AddressKeyInfoDto): FormattedAddressKey {
  return {
    address: info.address,
    path: info.path,
    wif: info.wif,
    privateKeyHex: bytesToHex(info.privateKey),
    publicKeyHex: bytesToHex(info.publicKey),
  }
}
