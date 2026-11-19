import type { TransferPageType } from '@renderer/constants'

export const MASTERNODE_YOUR_ADDRESSES_HEADING = 'Your addresses'
export const MASTERNODE_CHANGE_ADDRESS_DESCRIPTION = 'Your change address'
export const MASTERNODE_REQUEST_ADDRESS_DESCRIPTION = 'Saved receive request'

export const MASTERNODE_PAYOUT_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Payout address',
  placeholder: 'Search by label, contact, or paste Core address',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No matching contacts',
}

export const MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Operator payout address (optional)',
  placeholder: 'Search by label, contact, or leave empty',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No matching contacts',
}

export const MASTERNODE_VOTING_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'External P2PKH voting address',
  placeholder: 'Search by label, contact, or paste P2PKH address',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No matching contacts',
}

export const MASTERNODE_OWNER_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Custom P2PKH owner address',
  placeholder: 'Search by label, contact, or paste P2PKH address',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No matching contacts',
}

export const MASTERNODE_FEE_SOURCE_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Fee source address',
  placeholder: 'Search by label, contact, or paste funded Core address',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No matching contacts',
}
