import type { CreateWalletStep, WalletCreationPath } from '@renderer/types/auth'
import type { StepProgress } from '@renderer/types/StepProgress'
import { WALLET_PASSWORD_PLACEHOLDER } from './password'

export interface BaseTexts {
  title: string
  description: string
}

export interface CreateWalletTexts extends BaseTexts {
  labelPassword: string
  labelConfirmPassword: string
  placeholderPassword: string
  placeholderConfirmPassword: string
  buttonNext: string
  importWallet: string
  slowCreationNotice: string
}

export interface SaveYourSeedPhraseTexts extends BaseTexts {
  buttonContinue: string
  buttonCopy: string
}

export interface FillInYourSeedPhraseTexts extends BaseTexts{
  buttonContinue: string
}

export interface SuccessTexts extends BaseTexts {
  subtitle: string
  buttonContinue: string
}

export interface WelcomeTexts {
  titlePrefix: string
  titleHighlight: string
  description: string
  buttonCreateWallet: string
  buttonImportSeedPhrase: string
}

export interface ImportSeedPhraseTexts extends BaseTexts {
  title: string
  description: string
  buttonContinue: string
}

export interface ConnectionModeTexts extends BaseTexts {
  backgroundSyncTitle: string
  buttonCreate: string
  buttonImport: string
}

export interface AuthTexts {
  createWallet: CreateWalletTexts
  saveYourSeedPhrase: SaveYourSeedPhraseTexts
  fillInYourSeedPhrase: FillInYourSeedPhraseTexts
  seedPhraseWarning: BaseTexts
  success: SuccessTexts,
  successImport: SuccessTexts,
  welcome: WelcomeTexts,
  importSeedPhrase: ImportSeedPhraseTexts,
  connectionMode: ConnectionModeTexts,
}

export const AUTH_CTA_CLASS = 'rounded-[.9375rem] p-4.5'

export const PASSPHRASE_PREVIEW = {
  query: 'preview',
  value: 'passphrase',
  badge: 'BIP39 preview · Use test words only',
  flowBadge: 'BIP39 preview · Simulated changes',
  finishHint: 'Finish the preview to see the confirmation screen.',
  finish: 'Finish preview',
  success: {
    title: 'BIP39 passphrase',
    subtitle: 'Preview complete',
    description: 'You completed the simulated wallet setup.',
    buttonContinue: 'Done',
  },
} as const

export const SEED_PASSPHRASE_COPY = {
  create: 'Add a BIP39 passphrase',
  import: 'Enter a BIP39 passphrase',
  optional: 'Optional',
  added: 'Added',
  label: 'BIP39 passphrase',
  confirm: 'Confirm BIP39 passphrase',
  placeholder: 'Enter passphrase',
  confirmPlaceholder: 'Repeat your passphrase',
  show: 'Show passphrase',
  infoLabel: 'About BIP39 passphrases',
  info: 'A BIP39 passphrase adds a second secret to your backup. Your seed words and passphrase together determine your wallet. A different passphrase opens a different wallet.',
  remove: 'Remove passphrase',
  mismatch: 'Passphrases don’t match.',
  createHint: 'Save it separately from your seed phrase. You’ll need both to restore this wallet.',
  importHint: 'If you used a passphrase when creating this wallet, enter it exactly as saved.',
  copyWords: 'Copy words',
  walletPasswordTitle: 'Set wallet password',
  walletPasswordHint: 'Unlocks this wallet on this device.',
  walletPasswordConfirm: 'Confirm wallet password',
  backupWords: 'Write these words down and store them somewhere safe.',
  backupTitle: 'Save both recovery secrets',
  warning: 'Anyone with your seed phrase and passphrase can spend your funds.',
} as const

export const CREATE_WALLET_PREVIOUS_STEPS: Partial<Record<CreateWalletStep, CreateWalletStep>> = {
  password: 'welcome',
  'seed-phrase': 'password',
  verify: 'seed-phrase',
  'import-seed-phrase': 'welcome',
  'password-import': 'import-seed-phrase',
}

export const CONNECTION_MODE_PREVIOUS_STEPS: Record<WalletCreationPath, CreateWalletStep> = {
  create: 'verify',
  import: 'password-import',
}

export const CREATE_WALLET_PROGRESS: Record<WalletCreationPath, StepProgress<Partial<Record<CreateWalletStep, number>>>> = {
  create: {
    totalSteps: 4,
    stepNumbers: {
      password: 1,
      'seed-phrase': 2,
      verify: 3,
      'connection-mode': 4,
    },
  },
  import: {
    totalSteps: 3,
    stepNumbers: {
      'import-seed-phrase': 1,
      'password-import': 2,
      'connection-mode': 3,
    },
  },
}

export const authTexts: AuthTexts = {
  createWallet: {
    title: 'Create Wallet',
    description: 'This password unlocks the wallet on this device.',
    labelPassword: 'Password',
    labelConfirmPassword: 'Confirm Password',
    placeholderPassword: WALLET_PASSWORD_PLACEHOLDER,
    placeholderConfirmPassword: 'Repeat your password',
    buttonNext: 'Next',
    importWallet: 'Import wallet instead',
    slowCreationNotice: 'Securing your wallet…'
  },
  saveYourSeedPhrase: {
    title: 'Save your Seed Phrase',
    description: 'Write these words on paper — they are your wallet\'s only backup.',
    buttonContinue: 'Continue',
    buttonCopy: 'Copy'
  },
  fillInYourSeedPhrase: {
    title: 'Fill in your Seed Phrase',
    description: 'Fill in the missing words to confirm your backup.',
    buttonContinue: 'Continue'
  },
  seedPhraseWarning: {
    title: 'Never share your recovery phrase',
    description: 'Anyone with these words can spend your funds.'
  },
  success: {
    title: 'Your Wallet Was',
    subtitle: 'Succesfully Created',
    description: 'Enjoy the best Desktop Experience for Dash!',
    buttonContinue: 'Continue'
  },
  successImport: {
    title: 'Your Wallet Was',
    subtitle: 'Succesfully Imported',
    description: 'Enjoy the best Desktop Experience for Dash!',
    buttonContinue: 'Continue'
  },
  welcome: {
    titlePrefix: 'Welcome to',
    titleHighlight: 'Dash Desktop Wallet',
    description: 'Enjoy all the benefits of using Dash on your desktop device',
    buttonCreateWallet: 'Create Wallet',
    buttonImportSeedPhrase: 'Import Seed Phrase',
  },
  importSeedPhrase: {
    title: 'Import your Seed Phrase',
    description: 'Paste your existing Dash Seed Phrase',
    buttonContinue: 'Continue'
  },
  connectionMode: {
    title: 'Choose a connection mode',
    description: 'You can change this later in Connection Settings.',
    backgroundSyncTitle: 'Also sync P2P in the background',
    buttonCreate: 'Create Wallet',
    buttonImport: 'Import Wallet',
  },
}
