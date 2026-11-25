import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from 'dash-ui-kit/react'
import AddKeysConfirmStep from '@renderer/components/pages/identities/addKeys/AddKeysConfirmStep'
import KeyVariantList from '@renderer/components/pages/identities/addKeys/KeyVariantList'
import {
  KEY_BOUNDS_COPY,
  KEY_BOUNDS_FIELD_INVALID_CLASS,
  KEY_EXPIRY_PRESETS,
  KEY_LIMITS_COPY,
} from '@renderer/constants/identityKeys'
import { DAY_MS } from '@renderer/constants/timeLeft'
import { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant, KeyBudgetUnit } from '@renderer/enums/IdentityKeys'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { KeyVariantListProps } from '@renderer/types/IdentityKeys'
import { formatTimestamp } from '@renderer/utils/date'
import { formatLocalDateTimeInput, validateKeySelection } from '@renderer/utils/identityKeyRequests'

vi.mock('@renderer/hooks/useBalanceVisibility', () => ({ useBalanceVisibility: () => ({ isBalanceVisible: true }) }))
vi.mock('@renderer/hooks/useFiat', () => ({ useFiat: () => ({ rateReady: false, format: () => '' }) }))
vi.stubGlobal('React', React)

const CUSTOM_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
const NOW = new Date(2026, 10, 24, 10, 30, 0, 0).getTime()
const FUTURE = NOW + 7 * DAY_MS
const FUTURE_STR = formatLocalDateTimeInput(FUTURE)
const PAST_STR = formatLocalDateTimeInput(NOW - 60_000)

const IDENTITY: IdentityApiDto = {
  identityIndex: 0,
  identifier: 'B7kcEqgCRhLp2Wq5WZbeT4yUcZR8BWh3X1o3qDtLCpQH',
  usernames: ['alice.dash'],
  keys: [],
  balance: { amount: 250_000_000n, usdAmount: '0' },
  derivationPath: "m/9'/1'/5'/0'/0'",
  assetLockTxid: null,
}

function render(element: React.JSX.Element, theme: 'light' | 'dark' = 'light'): string {
  return renderToStaticMarkup(<ThemeProvider initialTheme={theme}>{element}</ThemeProvider>).replace(/<!-- -->/g, '')
}

function listMarkup(props: Partial<KeyVariantListProps> = {}, theme: 'light' | 'dark' = 'light'): string {
  const selected = props.selected ?? []
  return render(
    <KeyVariantList
      existing={[]}
      selected={selected}
      recommended={[]}
      boundsDrafts={{}}
      limitsDrafts={{}}
      now={NOW}
      check={validateKeySelection(selected)}
      onToggle={() => {}}
      onChangeBounds={() => {}}
      onChangeLimits={() => {}}
      onSelectExpiryPreset={() => {}}
      onToggleBudgetUnit={() => {}}
      {...props}
    />,
    theme,
  )
}

describe('KeyVariantList contract bounds editor', () => {
  it('shows Not bound captions for all five bindable variants and hides inputs when unchecked', () => {
    const markup = listMarkup()
    expect(markup.match(/Not bound/g)).toHaveLength(5)
    expect(markup).not.toContain(KEY_BOUNDS_COPY.contractIdLabel)
    expect(markup).not.toContain(KEY_BOUNDS_COPY.documentTypeLabel)
    expect(markup).not.toContain(KEY_LIMITS_COPY.budgetLabel)
    expect(markup).not.toContain(KEY_LIMITS_COPY.expiresAtLabel)
  })

  it('renders contract bounds inputs only for checked bindable variants', () => {
    const markup = listMarkup({
      selected: [IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay, IdentityKeyVariant.Enc, IdentityKeyVariant.AuthHigh, IdentityKeyVariant.Transfer],
    })
    expect(markup.split(KEY_BOUNDS_COPY.contractIdLabel).length - 1).toBe(4)
    expect(markup.split(KEY_BOUNDS_COPY.documentTypeLabel).length - 1).toBe(4)
    expect(markup).toContain(`aria-label="Encryption · Medium ${KEY_BOUNDS_COPY.contractIdLabel}"`)
    expect(markup).toContain(`aria-label="Authentication · High ${KEY_BOUNDS_COPY.contractIdLabel}"`)
    expect(markup).not.toContain(`aria-label="Transfer · Critical ${KEY_BOUNDS_COPY.contractIdLabel}"`)
    expect(markup.match(/aria-label="[^"]*Contract ID \(optional\)"/g)).toHaveLength(2)
  })

  it('shows dynamic bound caption and validation errors across light and dark themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const validMarkup = listMarkup({
        selected: [IdentityKeyVariant.Enc],
        boundsDrafts: { [IdentityKeyVariant.Enc]: { contractId: CUSTOM_CONTRACT_ID, documentType: 'note' } },
      }, theme)
      expect(validMarkup).toContain(`${CUSTOM_CONTRACT_ID} · note`)
      expect(validMarkup).toContain('font-mono')
      expect(validMarkup).toContain(KEY_BOUNDS_COPY.clearContractId)
      expect(validMarkup).toContain(KEY_BOUNDS_COPY.clearDocumentType)

      const invalidMarkup = listMarkup({
        selected: [IdentityKeyVariant.AuthHigh],
        boundsDrafts: { [IdentityKeyVariant.AuthHigh]: { contractId: 'invalid', documentType: 'bad doc' } },
      }, theme)
      expect(invalidMarkup).toContain('aria-invalid="true"')
      expect(invalidMarkup).toContain(KEY_BOUNDS_FIELD_INVALID_CLASS)
      expect(invalidMarkup).toContain(KEY_BOUNDS_COPY.invalidContractId)
      expect(invalidMarkup).toContain(KEY_BOUNDS_COPY.invalidDocumentType)
    }
  })
})

describe('KeyVariantList key limits editor', () => {
  it('renders key limits inputs and presets only for checked non-MASTER authentication variants', () => {
    const markup = listMarkup({
      selected: [
        IdentityKeyVariant.EncDashPay,
        IdentityKeyVariant.DecDashPay,
        IdentityKeyVariant.AuthCritical,
        IdentityKeyVariant.AuthHigh,
        IdentityKeyVariant.AuthMedium,
        IdentityKeyVariant.Enc,
        IdentityKeyVariant.Dec,
        IdentityKeyVariant.Transfer,
      ],
    })
    expect(markup.match(/aria-label="[^"]*Total budget \(optional\)"/g)).toHaveLength(3)
    expect(markup.match(/aria-label="[^"]*Expires at \(optional\)"/g)).toHaveLength(3)
    expect(markup.match(/aria-label="[^"]*Expires at \(optional\) (?:24h|7d|30d|90d)"/g)).toHaveLength(12)
    for (const label of ['Authentication · Critical', 'Authentication · High', 'Authentication · Medium']) {
      expect(markup).toContain(`aria-label="${label} ${KEY_LIMITS_COPY.budgetLabel}"`)
      expect(markup).toContain(`aria-label="${label} ${KEY_LIMITS_COPY.expiresAtLabel}"`)
      for (const preset of KEY_EXPIRY_PRESETS) {
        expect(markup).toContain(`aria-label="${label} ${KEY_LIMITS_COPY.expiresAtLabel} ${preset.label}"`)
      }
    }
    for (const label of ['Encryption · Medium', 'Decryption · Medium', 'Transfer · Critical']) {
      expect(markup).not.toContain(`aria-label="${label} ${KEY_LIMITS_COPY.budgetLabel}"`)
      expect(markup).not.toContain(`aria-label="${label} ${KEY_LIMITS_COPY.expiresAtLabel}"`)
    }
  })

  it('shows valid budget and expiry captions, unit toggle hint, and clear buttons in light and dark themes', () => {
    const until = `${KEY_LIMITS_COPY.untilPrefix} ${formatTimestamp(new Date(FUTURE))}`
    for (const theme of ['light', 'dark'] as const) {
      const dashMarkup = listMarkup({
        selected: [IdentityKeyVariant.AuthHigh],
        boundsDrafts: { [IdentityKeyVariant.AuthHigh]: { contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' } },
        limitsDrafts: {
          [IdentityKeyVariant.AuthHigh]: { totalBudget: '0.1', budgetUnit: KeyBudgetUnit.Dash, expiresAt: FUTURE_STR },
        },
      }, theme)
      expect(dashMarkup).toContain(`${CUSTOM_CONTRACT_ID} · domain · Max 0.1 Dash · ${until}`)
      expect(dashMarkup).toContain(`10,000,000,000 ${KEY_LIMITS_COPY.unitCredits}`)
      expect(dashMarkup).toContain(KEY_LIMITS_COPY.unitDash)
      expect(dashMarkup).toContain(KEY_LIMITS_COPY.toggleBudgetUnit)
      expect(dashMarkup).toContain(KEY_LIMITS_COPY.clearBudget)
      expect(dashMarkup).toContain(KEY_LIMITS_COPY.clearExpiresAt)
      expect(dashMarkup).not.toContain('truncate font-mono')

      const creditsMarkup = listMarkup({
        selected: [IdentityKeyVariant.AuthMedium],
        limitsDrafts: {
          [IdentityKeyVariant.AuthMedium]: { totalBudget: '5000000000', budgetUnit: KeyBudgetUnit.Credits, expiresAt: '' },
        },
      }, theme)
      expect(creditsMarkup).toContain('Not bound · Max 0.05 Dash')
      expect(creditsMarkup).toContain(`0.05 ${KEY_LIMITS_COPY.unitDash}`)
      expect(creditsMarkup).toContain(KEY_LIMITS_COPY.unitCredits)
      expect(creditsMarkup).toContain(KEY_LIMITS_COPY.budgetCreditsPlaceholder)
      expect(creditsMarkup).not.toContain(KEY_LIMITS_COPY.clearExpiresAt)
    }
  })

  it('shows budget and expiry validation errors with invalid field state across light and dark themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const invalidMarkup = listMarkup({
        selected: [IdentityKeyVariant.AuthCritical, IdentityKeyVariant.AuthHigh],
        limitsDrafts: {
          [IdentityKeyVariant.AuthCritical]: { totalBudget: '0', budgetUnit: KeyBudgetUnit.Dash, expiresAt: PAST_STR },
          [IdentityKeyVariant.AuthHigh]: { totalBudget: '1.5', budgetUnit: KeyBudgetUnit.Credits, expiresAt: '2026-02-30T10:00' },
        },
      }, theme)
      expect(invalidMarkup.match(/aria-invalid="true"/g)).toHaveLength(4)
      expect(invalidMarkup).toContain(KEY_BOUNDS_FIELD_INVALID_CLASS)
      expect(invalidMarkup).toContain(KEY_LIMITS_COPY.invalidBudgetDash)
      expect(invalidMarkup).toContain(KEY_LIMITS_COPY.expiredExpiresAt)
      expect(invalidMarkup).toContain(KEY_LIMITS_COPY.invalidBudgetCredits)
      expect(invalidMarkup).toContain(KEY_LIMITS_COPY.invalidExpiresAt)
    }
  })
})

describe('AddKeysConfirmStep', () => {
  it('renders full custom bound and limit labels with word wrapping across light and dark themes', () => {
    const until = `${KEY_LIMITS_COPY.untilPrefix} ${formatTimestamp(new Date(FUTURE))}`
    for (const theme of ['light', 'dark'] as const) {
      const markup = render(
        <AddKeysConfirmStep
          identity={IDENTITY}
          feeCredits={1_000n}
          requests={[
            {
              purpose: IdentityKeyPurpose.Encryption,
              securityLevel: IdentityKeySecurityLevel.Medium,
              contractBounds: { contractId: CUSTOM_CONTRACT_ID, documentType: 'note' },
            },
            {
              purpose: IdentityKeyPurpose.Authentication,
              securityLevel: IdentityKeySecurityLevel.High,
              contractBounds: { contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' },
              totalBudget: 10_000_000_000n,
              expiresAt: FUTURE,
            },
          ]}
        />,
        theme,
      )
      expect(markup).toContain(`#0 Encryption · Medium · ${CUSTOM_CONTRACT_ID} · note`)
      expect(markup).toContain(`#1 Authentication · High · ${CUSTOM_CONTRACT_ID} · domain · Max 0.1 Dash · ${until}`)
      expect(markup).toContain('min-w-0 wrap-anywhere text-right')
    }
  })
})
