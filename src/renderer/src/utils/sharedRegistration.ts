import type {
  SharedRegistrationFundingPreviewDto,
  SharedRegistrationSignatureDto,
} from '@renderer/api/types'
import { MIN_SHARED_TX_HEX_LENGTH, SHARED_WIZARD_COPY } from '@renderer/constants/sharedRegistration'
import { SharedRegistrationStage } from '@renderer/enums/Masternodes'
import type { SharedStageEligibility } from '@renderer/types/SharedRegistration'

export function normalizeSharedTxHex(raw: string): string {
  return raw.trim().replace(/^0x/i, '').replace(/\s+/g, '')
}

export function isPlausibleTxHex(hex: string): boolean {
  return hex.length >= MIN_SHARED_TX_HEX_LENGTH
    && hex.length % 2 === 0
    && /^[0-9a-fA-F]+$/.test(hex)
}

export function canSignSharedStage(
  preview: SharedRegistrationFundingPreviewDto | null,
  stage: SharedRegistrationStage,
): SharedStageEligibility {
  if (preview == null) return { canSign: false, reason: null }
  if (stage === SharedRegistrationStage.Consent) {
    return preview.signableShares.length > 0
      ? { canSign: true, reason: null }
      : { canSign: false, reason: SHARED_WIZARD_COPY.noSignableShares }
  }
  return preview.fundingInputs.length > 0
    ? { canSign: true, reason: null }
    : { canSign: false, reason: SHARED_WIZARD_COPY.noFundingInputs }
}

export function formatConsentSignaturesForCopy(signatures: SharedRegistrationSignatureDto[]): string {
  if (signatures.length === 1) return signatures[0].signature
  return signatures.map(entry => `${entry.shareIndex}: ${entry.signature}`).join('\n')
}
