import { describe, expect, it } from 'vitest'
import type { SharedRegistrationFundingPreviewDto } from '@renderer/api/types'
import { SHARED_WIZARD_COPY } from '@renderer/constants/sharedRegistration'
import { SharedRegistrationStage } from '@renderer/enums/Masternodes'
import {
  canSignSharedStage,
  formatConsentSignaturesForCopy,
  isPlausibleTxHex,
  normalizeSharedTxHex,
} from '@renderer/utils/sharedRegistration'

function makePreview(overrides: Partial<SharedRegistrationFundingPreviewDto> = {}): SharedRegistrationFundingPreviewDto {
  return {
    consentHash: 'ab'.repeat(32),
    shares: [
      {
        index: 0,
        amountDuffs: 60_000_000_000n,
        ownerAddress: 'Xowner0',
        refundAddress: 'Xrefund0',
        rewardAddress: 'Xreward0',
      },
      {
        index: 1,
        amountDuffs: 40_000_000_000n,
        ownerAddress: 'Xowner1',
        refundAddress: null,
        rewardAddress: null,
      },
    ],
    signableShares: [0],
    outputs: [
      { address: null, amountDuffs: 100_000_000_000n, collateral: true },
    ],
    collateralDuffs: 100_000_000_000n,
    warning: null,
    fundingInputs: [
      { index: 0, address: 'Xfund0', amountDuffs: 60_000_000_000n },
    ],
    fundingTotalDuffs: 60_000_000_000n,
    unresolvedInputs: 1,
    ...overrides,
  }
}

describe('sharedRegistration helpers', () => {
  it('normalizes whitespace and 0x prefixes from pasted tx hex and validates hex shape', () => {
    const sample = 'aa'.repeat(32)
    expect(normalizeSharedTxHex(` 0x${sample.slice(0, 10)}\n${sample.slice(10)} `)).toBe(sample)
    expect(isPlausibleTxHex(sample)).toBe(true)
    expect(isPlausibleTxHex('abcd')).toBe(false)
    expect(isPlausibleTxHex('ab'.repeat(31) + 'a')).toBe(false)
    expect(isPlausibleTxHex('zz'.repeat(32))).toBe(false)
  })

  it('determines signing eligibility separately for Consent and Funding stages', () => {
    expect(canSignSharedStage(null, SharedRegistrationStage.Consent)).toEqual({ canSign: false, reason: null })

    const fullPreview = makePreview()
    expect(canSignSharedStage(fullPreview, SharedRegistrationStage.Consent)).toEqual({ canSign: true, reason: null })
    expect(canSignSharedStage(fullPreview, SharedRegistrationStage.Funding)).toEqual({ canSign: true, reason: null })

    const noShares = makePreview({ signableShares: [] })
    expect(canSignSharedStage(noShares, SharedRegistrationStage.Consent)).toEqual({
      canSign: false,
      reason: SHARED_WIZARD_COPY.noSignableShares,
    })
    expect(canSignSharedStage(noShares, SharedRegistrationStage.Funding)).toEqual({ canSign: true, reason: null })

    const noFunding = makePreview({ fundingInputs: [], fundingTotalDuffs: 0n })
    expect(canSignSharedStage(noFunding, SharedRegistrationStage.Funding)).toEqual({
      canSign: false,
      reason: SHARED_WIZARD_COPY.noFundingInputs,
    })
  })

  it('formats single and multi-share consent signatures cleanly for clipboard copy', () => {
    expect(formatConsentSignaturesForCopy([{ shareIndex: 0, signature: 'sig0==' }])).toBe('sig0==')
    expect(formatConsentSignaturesForCopy([
      { shareIndex: 0, signature: 'sig0==' },
      { shareIndex: 2, signature: 'sig2==' },
    ])).toBe('0: sig0==\n2: sig2==')
  })
})
