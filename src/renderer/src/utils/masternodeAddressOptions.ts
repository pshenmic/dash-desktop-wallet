import type { WalletAddressDto } from '@renderer/api/types'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import type { DropdownFieldOption } from '@renderer/types/DropdownField'
import type { ReceiveRequestDto } from '@renderer/types/ReceiveRequest'
import { ownRecipientOptions } from './ownRecipients'

export function masternodeWalletAddressOptions(
  receiving: WalletAddressDto[],
  change: WalletAddressDto[],
  requests: ReadonlyArray<Pick<ReceiveRequestDto, 'address' | 'label' | 'kind'>>,
  labelsByAddress: ReadonlyMap<string, string>,
): DropdownFieldOption[] {
  return ownRecipientOptions(DestinationKind.CoreAddress, {
    receiving,
    change,
    platformAddresses: [],
    shieldedAddresses: [],
    shieldedNotes: null,
    identities: [],
    receiveRequests: requests,
    labelsByAddress,
  })
}
