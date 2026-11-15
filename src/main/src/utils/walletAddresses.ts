import {Address} from '../types/Address'
import {GroupedAddresses} from '../types/GroupedAddresses'

// Every address the wallet owns, across both BIP-44 chains and the DashPay
// chains outside them.
export function walletAddresses(grouped: GroupedAddresses): Address[] {
  return [...grouped.receiving, ...grouped.change, ...grouped.dashPay ?? []]
}
