import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearRegisterWizardDraft,
  createInitialRegisterDraft,
  getOrCreateRegisterWizardState,
  hasCustomRegisterWizardDraft,
  resetRegisterWizardDraft,
  saveRegisterWizardState,
  setRegisterWizardActive,
} from '@renderer/utils/masternodeRegistrationDraft'

describe('masternodeRegistrationDraft', () => {
  beforeEach(() => {
    clearRegisterWizardDraft('wallet-a')
    clearRegisterWizardDraft('wallet-b')
  })

  it('persists step, draft fields, and active state per wallet across route navigation', () => {
    const initial = getOrCreateRegisterWizardState('wallet-a', 'testnet')
    expect(initial.active).toBe(false)
    expect(initial.step).toBe(0)
    expect(initial.draft.servicePort).toBe('19999')
    expect(hasCustomRegisterWizardDraft(initial, 'testnet')).toBe(false)

    setRegisterWizardActive('wallet-a', 'testnet', true)
    saveRegisterWizardState('wallet-a', {
      active: true,
      step: 2,
      draft: {
        ...initial.draft,
        type: 'Evo',
        payoutAddress: 'yPayoutAddr',
      },
    })

    const restored = getOrCreateRegisterWizardState('wallet-a', 'testnet')
    expect(restored.active).toBe(true)
    expect(restored.step).toBe(2)
    expect(restored.draft.type).toBe('Evo')
    expect(restored.draft.payoutAddress).toBe('yPayoutAddr')
    expect(hasCustomRegisterWizardDraft(restored, 'testnet')).toBe(true)

    const otherWallet = getOrCreateRegisterWizardState('wallet-b', 'mainnet')
    expect(otherWallet.active).toBe(false)
    expect(otherWallet.draft.servicePort).toBe('9999')
    expect(otherWallet.draft.payoutAddress).toBe('')
  })

  it('pauses active navigation cleanly without losing draft, and clears on reset or broadcast', () => {
    const base = createInitialRegisterDraft('testnet')
    saveRegisterWizardState('wallet-a', {
      active: true,
      step: 1,
      draft: { ...base, payoutAddress: 'ySaved' },
    })

    const paused = setRegisterWizardActive('wallet-a', 'testnet', false)
    expect(paused.active).toBe(false)
    expect(paused.step).toBe(1)
    expect(paused.draft.payoutAddress).toBe('ySaved')

    const reset = resetRegisterWizardDraft('wallet-a', 'testnet', true)
    expect(reset.active).toBe(true)
    expect(reset.step).toBe(0)
    expect(reset.draft.payoutAddress).toBe('')
    expect(hasCustomRegisterWizardDraft(reset, 'testnet')).toBe(false)

    clearRegisterWizardDraft('wallet-a')
    expect(getOrCreateRegisterWizardState('wallet-a', 'testnet').active).toBe(false)
  })
})
