
export interface ReceivePageType {
  tabs: {
    core: string
    shielded: string
    platform: string
  },
  receiveAddressCard: {
    addressText: string
    amount: string
    placeholder: string
  }
}

export const receivePage = {
  tabs: {
    core: 'Core',
    shielded: 'Shielded',
    platform: 'Platform',
  },
  receiveAddressCard: {
    addressText: 'Dash Address',
    amount: 'Amount',
    placeholder: 'Optional',
  },
}

export const receiveCardCopy = {
  platformNote: 'Accepts Dash Platform credits only.',
  privateChip: 'Private',
  shieldedUnlockPrompt: 'Enter your wallet password to show your shielded address.',
  shieldedDerivePrompt: 'All unlocked shielded addresses have been requested. Enter your wallet password to derive a new one.',
  showAddress: 'Show address',
  loadFailed: "Couldn't load the address. Try again.",
  allShieldedFunded: 'Every shielded address already holds funds.',
  generating: 'Generating…',
}

export const RECEIVE_REQUESTS_STORAGE_PREFIX = 'wallet.receiveRequests.'

export const RECEIVE_LABEL_MAX_LENGTH = 80

export const RECEIVE_FORM_COPY = {
  labelField: 'Label',
  labelPlaceholder: 'Enter a label for this address',
  amountField: 'Amount',
  amountPlaceholder: '0.00000000',
  generateButton: 'Save payment address',
  generatingButton: 'Saving…',
  clearButton: 'Clear',
} as const

export const RECEIVE_HISTORY_COPY = {
  title: 'Requested payments history',
  empty: 'No payment requests yet. Save a payment address above to add one.',
  loadFailed: 'Failed to load payment requests',
  dateHeader: 'Date',
  labelHeader: 'Label',
  addressHeader: 'Address',
  amountHeader: 'Requested (Dash)',
  actionsHeader: 'Actions',
  noLabel: '(no label)',
  noAmount: '(no amount requested)',
  showAction: 'Show payment request',
  copyAddressAction: 'Copy address',
  copyLinkAction: 'Copy payment link',
  copyAmountAction: 'Copy requested amount',
  deleteAction: 'Remove payment request',
  requestCreated: 'Payment address saved',
  requestFailed: 'Could not save payment address',
  deleteSuccess: 'Payment request removed',
  deleteFailed: 'Could not remove payment request',
} as const

export const RECEIVE_MODAL_COPY = {
  titlePrefix: 'Request payment to',
  defaultTitle: 'Payment request',
  paymentInfo: 'Payment information',
  uriLabel: 'URI',
  addressLabel: 'Address',
  labelField: 'Label',
  amountField: 'Amount',
  copyUri: 'Copy URI',
  copyAddress: 'Copy address',
  copyAmount: 'Copy sum',
  copiedUri: 'Payment link copied',
  copiedAddress: 'Address copied',
  copiedAmount: 'Requested amount copied',
} as const
