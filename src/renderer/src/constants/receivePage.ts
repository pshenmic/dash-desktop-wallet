
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
  showAddress: 'Show address',
  loadFailed: "Couldn't load the address. Try again.",
  allShieldedFunded: 'Every shielded address already holds funds.',
  generating: 'Generating…',
}
