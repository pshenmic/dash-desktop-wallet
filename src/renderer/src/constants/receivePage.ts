
export interface ReceivePageType {
  tabs: {
    core: string
    shielded: string
    platform: string
  },
  receiveAddressCard: {
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
    amount: 'Enter amount',
    placeholder: 'Optional',
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
