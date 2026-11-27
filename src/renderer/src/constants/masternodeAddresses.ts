import type { TransferPageType } from '@renderer/constants'

export const MASTERNODE_YOUR_ADDRESSES_HEADING = 'Your addresses'
export const MASTERNODE_FUNDED_ADDRESSES_HEADING = 'Funded wallet addresses'
export const MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION = 'Your receiving address'
export const MASTERNODE_CHANGE_ADDRESS_DESCRIPTION = 'Your change address'
export const MASTERNODE_FEE_UTXO_FORMS = { one: 'UTXO', other: 'UTXOs' } as const

export const MASTERNODE_PAYOUT_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Payout address',
  placeholder: 'Enter Address…',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No addresses found',
}

export const MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Operator payout address (optional)',
  placeholder: 'Enter Address…',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No addresses found',
}

export const MASTERNODE_VOTING_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'External P2PKH voting address',
  placeholder: 'Enter Address…',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No addresses found',
}

export const MASTERNODE_OWNER_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Custom P2PKH owner address',
  placeholder: 'Enter Address…',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No addresses found',
}

export const MASTERNODE_FEE_SOURCE_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Fee source address',
  placeholder: 'Select funded wallet address…',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No wallet addresses with confirmed non-collateral coins',
}
