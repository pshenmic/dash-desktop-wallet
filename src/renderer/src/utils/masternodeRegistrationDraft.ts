import type { Network } from '@renderer/api/types'
import {
  MAINNET_CORE_PORT,
  MAINNET_PLATFORM_HTTP_PORT,
  MAINNET_PLATFORM_P2P_PORT,
  TESTNET_DEFAULT_CORE_PORT,
  TESTNET_DEFAULT_PLATFORM_HTTP_PORT,
  TESTNET_DEFAULT_PLATFORM_P2P_PORT,
} from '@renderer/constants/masternodes'
import type {
  PersistedRegisterWizardState,
  RegisterWizardDraft,
} from '@renderer/types/MasternodeRegistrationWizard'

const registerWizardDrafts = new Map<string, PersistedRegisterWizardState>()

export function createInitialRegisterDraft(network: Network | null): RegisterWizardDraft {
  const isTestnet = network === 'testnet'
  return {
    type: 'Regular',
    collateralSource: 'wallet',
    selectedCollateral: '',
    manualTxid: '',
    manualVout: '0',
    feeSourceMode: 'auto',
    feeSourceAddress: '',
    payoutMode: 'wallet',
    payoutAddress: '',
    ownerMode: 'wallet',
    ownerAddress: '',
    votingMode: 'wallet',
    votingAddress: '',
    operatorMode: 'wallet',
    operatorPublicKey: '',
    operatorRewardPercent: '0',
    operatorPayoutAddress: '',
    serviceMode: 'later',
    serviceIp: '',
    servicePort: String(isTestnet ? TESTNET_DEFAULT_CORE_PORT : MAINNET_CORE_PORT),
    platformNodeId: '',
    platformP2PPort: String(isTestnet ? TESTNET_DEFAULT_PLATFORM_P2P_PORT : MAINNET_PLATFORM_P2P_PORT),
    platformHttpPort: String(isTestnet ? TESTNET_DEFAULT_PLATFORM_HTTP_PORT : MAINNET_PLATFORM_HTTP_PORT),
  }
}

export function hasCustomRegisterWizardDraft(
  state: Pick<PersistedRegisterWizardState, 'step' | 'draft'>,
  network: Network | null,
): boolean {
  if (state.step > 0) return true
  const initial = createInitialRegisterDraft(network)
  return (Object.keys(initial) as Array<keyof RegisterWizardDraft>).some(
    key => state.draft[key] !== initial[key],
  )
}

export function getOrCreateRegisterWizardState(
  walletId: string | undefined,
  network: Network | null,
): PersistedRegisterWizardState {
  if (!walletId) {
    return { active: false, step: 0, draft: createInitialRegisterDraft(network) }
  }
  const existing = registerWizardDrafts.get(walletId)
  if (existing) {
    if (existing.draft.payoutMode != null) return existing
    const migrated: PersistedRegisterWizardState = {
      ...existing,
      draft: {
        ...existing.draft,
        payoutMode: existing.draft.payoutAddress.trim() !== '' ? 'external' : 'wallet',
      },
    }
    registerWizardDrafts.set(walletId, migrated)
    return migrated
  }
  const created: PersistedRegisterWizardState = {
    active: false,
    step: 0,
    draft: createInitialRegisterDraft(network),
  }
  registerWizardDrafts.set(walletId, created)
  return created
}

export function saveRegisterWizardState(
  walletId: string | undefined,
  state: PersistedRegisterWizardState,
): void {
  if (!walletId) return
  registerWizardDrafts.set(walletId, state)
}

export function setRegisterWizardActive(
  walletId: string | undefined,
  network: Network | null,
  active: boolean,
): PersistedRegisterWizardState {
  const current = getOrCreateRegisterWizardState(walletId, network)
  const next: PersistedRegisterWizardState = { ...current, active }
  saveRegisterWizardState(walletId, next)
  return next
}

export function resetRegisterWizardDraft(
  walletId: string | undefined,
  network: Network | null,
  active = true,
): PersistedRegisterWizardState {
  const next: PersistedRegisterWizardState = {
    active,
    step: 0,
    draft: createInitialRegisterDraft(network),
  }
  saveRegisterWizardState(walletId, next)
  return next
}

export function clearRegisterWizardDraft(walletId: string | undefined): void {
  if (!walletId) return
  registerWizardDrafts.delete(walletId)
}
