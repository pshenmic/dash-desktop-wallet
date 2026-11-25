import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from 'dash-ui-kit/react'
import type { IdentityKeyDto } from '@renderer/api/types'
import IdentityKeysSection from '@renderer/components/pages/identities/keys/IdentityKeysSection'
import KeyTableRow from '@renderer/components/pages/identities/keys/KeyTableRow'
import {
  IDENTITY_KEYS_COPY,
  IDENTITY_KEY_UPDATE_COPY,
  KEY_LIMITS_COPY,
  KEYS_TABLE_HEADERS,
  KEYS_TABLE_MIN_WIDTH_CLASS,
} from '@renderer/constants/identityKeys'
import { DASHPAY_KEY_BOUNDS } from '@renderer/constants/dashPay'
import { STATUS_PILL_TONES } from '@renderer/constants/statusPill'
import { IdentityKeyAction } from '@renderer/enums/IdentityKeys'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import { formatTimestamp } from '@renderer/utils/date'
import { keyBoundsLabel } from '@renderer/utils/identityKeyRequests'

const NOW = 1_750_000_000_000
const FUTURE_EXPIRES_AT = NOW + 3_600_000
const PAST_EXPIRES_AT = NOW - 60_000
const DISABLED_AT = NOW - 120_000
const CUSTOM_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
const WALLET_ID = 'wallet-1'

vi.mock('@renderer/hooks/useFiat', () => ({ useFiat: () => ({ rateReady: false, format: () => '' }) }))
vi.mock('@renderer/hooks/useNow', () => ({ useNow: () => NOW }))
vi.mock('@renderer/contexts/AuthContext', () => ({ useAuth: () => ({ status: { network: 'testnet' } }) }))
vi.stubGlobal('React', React)

function makeKey(overrides: Partial<IdentityKeyDto> = {}): IdentityKeyDto {
  return {
    keyId: 1,
    purpose: 'AUTHENTICATION',
    securityLevel: 'HIGH',
    keyType: 'ECDSA_SECP256K1',
    data: '02ab',
    readOnly: false,
    disabledAt: null,
    contractBounds: null,
    totalBudget: null,
    expiresAt: null,
    ...overrides,
  }
}

function makeIdentity(keys: IdentityKeyDto[]): IdentityApiDto {
  return {
    identityIndex: 0,
    identifier: 'B7kcEqgCRhLp2Wq5WZbeT4yUcZR8BWh3X1o3qDtLCpQH',
    usernames: ['alice.dash'],
    keys,
    balance: { amount: 250_000_000_000n, usdAmount: '0' },
    derivationPath: "m/9'/1'/5'/0'/0'",
    assetLockTxid: null,
  }
}

function render(element: React.JSX.Element, theme: 'light' | 'dark' = 'light'): string {
  return renderToStaticMarkup(<ThemeProvider initialTheme={theme}>{element}</ThemeProvider>).replace(/<!-- -->/g, '')
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function rowClasses(html: string): string {
  return html.split('border-t ')[1]?.split('>')[0] ?? ''
}

describe('KeyTableRow', () => {
  it('renders em-dash in Bound to and Limits and Active status for an unbound unlimited key', () => {
    for (const theme of ['light', 'dark'] as const) {
      const markup = render(<KeyTableRow identityKey={makeKey()} now={NOW} onAction={() => {}} />, theme)
      expect(markup.split(`>${IDENTITY_KEYS_COPY.unbound}<`).length - 1).toBe(2)
      expect(markup).toContain(STATUS_PILL_TONES[StatusPillTone.Success])
      expect(markup).toContain(`>${IDENTITY_KEYS_COPY.active}<`)
      expect(rowClasses(markup)).not.toContain('opacity-50')
      expect(markup).toContain(`>${IDENTITY_KEY_UPDATE_COPY[IdentityKeyAction.Disable].action}<`)
    }
  })

  it('renders totalBudget in Dash, future expiresAt, and Active status', () => {
    const budgetKey = makeKey({ totalBudget: 25_000_000_000n, expiresAt: FUTURE_EXPIRES_AT })
    const untilText = `${KEY_LIMITS_COPY.untilPrefix} ${formatTimestamp(new Date(FUTURE_EXPIRES_AT))}`

    for (const theme of ['light', 'dark'] as const) {
      const markup = render(<KeyTableRow identityKey={budgetKey} now={NOW} onAction={() => {}} />, theme)
      const text = stripTags(markup)
      expect(text).toContain(`${KEY_LIMITS_COPY.maxPrefix} 0.25 Dash`)
      expect(text).toContain(untilText)
      expect(markup).toContain(STATUS_PILL_TONES[StatusPillTone.Success])
      expect(markup).toContain(`>${IDENTITY_KEYS_COPY.active}<`)
      expect(markup).not.toContain('text-dash-red')
    }
  })

  it('renders single-limit keys with only budget or only expiration', () => {
    const budgetOnly = render(<KeyTableRow identityKey={makeKey({ totalBudget: 25_000_000_000n })} now={NOW} onAction={() => {}} />)
    expect(stripTags(budgetOnly)).toContain(`${KEY_LIMITS_COPY.maxPrefix} 0.25 Dash`)
    expect(budgetOnly).not.toContain(KEY_LIMITS_COPY.untilPrefix)

    const expiryOnly = render(<KeyTableRow identityKey={makeKey({ expiresAt: FUTURE_EXPIRES_AT })} now={NOW} onAction={() => {}} />)
    expect(expiryOnly).toContain(`${KEY_LIMITS_COPY.untilPrefix} ${formatTimestamp(new Date(FUTURE_EXPIRES_AT))}`)
    expect(expiryOnly).not.toContain(KEY_LIMITS_COPY.maxPrefix)
  })

  it('renders Expired status, red expiry label, full row opacity, and Disable button when expiresAt <= now', () => {
    for (const expiresAt of [NOW, PAST_EXPIRES_AT]) {
      const expiredKey = makeKey({ expiresAt, disabledAt: null })
      const untilText = `${KEY_LIMITS_COPY.untilPrefix} ${formatTimestamp(new Date(expiresAt))}`

      for (const theme of ['light', 'dark'] as const) {
        const markup = render(<KeyTableRow identityKey={expiredKey} now={NOW} onAction={() => {}} />, theme)
        expect(markup).toContain(STATUS_PILL_TONES[StatusPillTone.Warning])
        expect(markup).toContain(`>${IDENTITY_KEYS_COPY.expired}<`)
        expect(markup).toContain('text-dash-red')
        expect(markup).toContain(untilText)
        expect(markup).toContain(`>${IDENTITY_KEY_UPDATE_COPY[IdentityKeyAction.Disable].action}<`)
        expect(rowClasses(markup)).not.toContain('opacity-50')
      }
    }
  })

  it('renders Disabled status and hides Disable even when expiresAt <= now', () => {
    const disabledKey = makeKey({ disabledAt: DISABLED_AT, expiresAt: PAST_EXPIRES_AT })

    for (const theme of ['light', 'dark'] as const) {
      const markup = render(<KeyTableRow identityKey={disabledKey} now={NOW} onAction={() => {}} />, theme)
      expect(markup).toContain(STATUS_PILL_TONES[StatusPillTone.Inactive])
      expect(markup).toContain(`>${IDENTITY_KEYS_COPY.disabled}<`)
      expect(markup).not.toContain(`>${IDENTITY_KEYS_COPY.expired}<`)
      expect(markup).not.toContain(`>${IDENTITY_KEY_UPDATE_COPY[IdentityKeyAction.Disable].action}<`)
      expect(rowClasses(markup)).toContain('opacity-50')
    }
  })

  it('renders full custom contractBounds with break-all and no truncation, and DashPay badge for DashPay bounds', () => {
    const boundKey = makeKey({ contractBounds: { contractId: CUSTOM_CONTRACT_ID, documentType: 'note' } })
    const markup = render(<KeyTableRow identityKey={boundKey} now={NOW} onAction={() => {}} />)
    expect(markup).toContain(`${CUSTOM_CONTRACT_ID} · note`)
    expect(markup).toContain('font-mono break-all')
    expect(markup).not.toContain(`${CUSTOM_CONTRACT_ID.slice(0, 8)}…`)

    const dashPayMarkup = render(<KeyTableRow identityKey={makeKey({ contractBounds: DASHPAY_KEY_BOUNDS })} now={NOW} onAction={() => {}} />)
    expect(dashPayMarkup).toContain(`>${keyBoundsLabel(DASHPAY_KEY_BOUNDS)!.text}<`)
  })
})

describe('IdentityKeysSection', () => {
  it('renders Limits column header, KEYS_TABLE_MIN_WIDTH_CLASS, and passes now to KeyTableRow', () => {
    const keys = [
      makeKey({ keyId: 0, securityLevel: 'MASTER' }),
      makeKey({ keyId: 1, totalBudget: 25_000_000_000n, expiresAt: PAST_EXPIRES_AT }),
    ]
    const identity = makeIdentity(keys)

    for (const theme of ['light', 'dark'] as const) {
      const markup = render(<IdentityKeysSection walletId={WALLET_ID} identity={identity} />, theme)
      for (const header of KEYS_TABLE_HEADERS) {
        if (header !== '') expect(markup).toContain(`>${header}<`)
      }
      expect(markup).toContain(KEYS_TABLE_MIN_WIDTH_CLASS)
      expect(markup).toContain(`>${IDENTITY_KEYS_COPY.expired}<`)
      expect(stripTags(markup)).toContain(`${KEY_LIMITS_COPY.maxPrefix} 0.25 Dash`)
    }
  })

  it('renders empty state when identity has no keys', () => {
    const markup = render(<IdentityKeysSection walletId={WALLET_ID} identity={makeIdentity([])} />)
    expect(markup).toContain(IDENTITY_KEYS_COPY.empty)
    expect(markup).not.toContain(KEYS_TABLE_MIN_WIDTH_CLASS)
  })
})
