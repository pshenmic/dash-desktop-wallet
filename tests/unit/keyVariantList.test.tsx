import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from 'dash-ui-kit/react'
import AddKeysConfirmStep from '@renderer/components/pages/identities/addKeys/AddKeysConfirmStep'
import KeyVariantList from '@renderer/components/pages/identities/addKeys/KeyVariantList'
import { KEY_BOUNDS_COPY, KEY_BOUNDS_FIELD_INVALID_CLASS } from '@renderer/constants/identityKeys'
import { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { KeyVariantListProps } from '@renderer/types/IdentityKeys'
import { validateKeySelection } from '@renderer/utils/identityKeyRequests'

vi.mock('@renderer/hooks/useBalanceVisibility', () => ({ useBalanceVisibility: () => ({ isBalanceVisible: true }) }))
vi.mock('@renderer/hooks/useFiat', () => ({ useFiat: () => ({ rateReady: false, format: () => '' }) }))
vi.stubGlobal('React', React)

const CUSTOM_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'

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
      check={validateKeySelection(selected)}
      onToggle={() => {}}
      onChangeBounds={() => {}}
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

describe('AddKeysConfirmStep', () => {
  it('renders full custom bound labels with word wrapping', () => {
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
        ]}
      />,
    )
    expect(markup).toContain(`#0 Encryption · Medium · ${CUSTOM_CONTRACT_ID} · note`)
    expect(markup).toContain('min-w-0 wrap-anywhere text-right')
  })
})
