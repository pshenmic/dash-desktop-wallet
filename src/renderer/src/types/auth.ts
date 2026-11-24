import type { ConnectionType, Network } from '@renderer/api/types'

export type CreateWalletStep =
  | 'password'
  | 'seed-phrase'
  | 'verify'
  | 'connection-mode'
  | 'success'
  | 'welcome'
  | 'import-seed-phrase'
  | 'password-import'

export type WordCount = 12 | 24

export type WalletCreationPath = 'create' | 'import'

export interface SeedPassphraseFieldProps {
  value: string
  onChange: (value: string) => void
  confirm?: boolean
  error?: string
  inputRef?: React.Ref<HTMLInputElement>
}

export interface SeedPassphraseProps {
  path: WalletCreationPath
  value: string
  onChange: (value: string) => void
}

export interface CreateWalletFlowProps {
  passphrasePreview: boolean
}

export interface AuthBackgroundProps {
  variant: 'welcome' | 'create' | 'login'
}

export interface UseCreateWalletState {
  step: CreateWalletStep
  password: string
  passphrase: string
  seedPhrase: string[]
  verifyPhrase: string[]
  importedSeedPhrase: string[]
  wordCount: WordCount
  network: Network
  path: WalletCreationPath | null
  createdWalletId: string | null
  isPreviewFlow: boolean
  creating: boolean
  connectionMode: ConnectionType
  backgroundSyncEnabled: boolean
  setPassword: (password: string) => void
  setPassphrase: (value: string) => void
  setWordCount: (count: WordCount) => void
  generateSeedPhrase: () => Promise<void>
  verifyMissingWords: (words: string[]) => Promise<void>
  verifySeedPhrase: () => void
  goBack: () => void
  setNetwork: (network: Network) => void
  setConnectionMode: (mode: ConnectionType) => void
  setBackgroundSyncEnabled: (enabled: boolean) => void
  goToPassword: () => void
  goToImportSeedPhrase: () => void
  submitImportSeedPhrase: (phrase: string[]) => void
  continueImportedWallet: () => void
  finishWalletCreation: () => Promise<void>
}

export interface ConnectionModeStepProps {
  mode: ConnectionType
  backgroundSyncEnabled: boolean
  actionLabel: string
  loadingNotice: string
  onModeChange: (mode: ConnectionType) => void
  onBackgroundSyncChange: (enabled: boolean) => void
  onConfirm: () => Promise<void>
}
