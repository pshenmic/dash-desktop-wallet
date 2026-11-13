
export const RECEIVE_LABEL_MAX_LENGTH = 80

export interface ReceivePageType {
  tabs: {
    core: string
    shielded: string
    platform: string
  },
  receiveAddressCard: {
    title: string
    label: string
    labelPlaceholder: string
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
    title: 'Request a payment',
    label: 'Label',
    labelPlaceholder: 'e.g. Invoice #42',
    amount: 'Amount',
    placeholder: '0.00000000',
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

export const RECEIVE_FORM_COPY = {
  title: 'Request a payment',
  labelField: 'Label',
  labelPlaceholder: 'e.g. Invoice #42',
  amountField: 'Amount',
  amountPlaceholder: '0.00000000',
  generateButton: 'Copy payment link',
  generatingButton: 'Copying…',
  clearButton: 'Clear',
  clickToCopyTooltip: 'Click to copy',
  copiedTooltip: 'Copied!',
} as const

export const RECEIVE_HISTORY_COPY = {
  title: 'Requested payments history',
  empty: 'No payment requests yet. Copy a payment link above to add one.',
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
  requestCreated: 'Payment link copied',
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
