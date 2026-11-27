import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from 'dash-ui-kit/react'
import TransactionDetail from '@renderer/components/pages/transactions/TransactionDetail'
import type { WalletTxItem } from '@renderer/types/WalletTransaction'

vi.mock('dash-ui-kit/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('dash-ui-kit/react')>()),
  Identifier: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
}))
vi.mock('@renderer/contexts/AuthContext', () => ({ useAuth: () => ({ status: { network: null, selectedWalletId: 'wallet' } }) }))
vi.mock('@renderer/hooks/useAdresses', () => ({ useAdresses: () => ({ receiving: [], change: [] }) }))
vi.mock('@renderer/hooks/useFiat', () => ({ useFiat: () => ({ format: () => '$0.00', rateReady: false }) }))
vi.mock('@renderer/hooks/useBalanceVisibility', () => ({ useBalanceVisibility: () => ({ isBalanceVisible: true }) }))
vi.mock('@renderer/api', () => ({ API: { getTransactionByHash: vi.fn() } }))
vi.stubGlobal('React', React)

function makeTx(overrides: Partial<WalletTxItem>): WalletTxItem {
  return {
    id: 'a'.repeat(64),
    status: 'pending',
    confirmations: 0,
    blockHeight: 0,
    size: 225,
    kind: 'core',
    title: 'Receive',
    subtitleLabel: 'from',
    labelValue: 'ySenderAddress',
    amount: 100_000_000n,
    usdAmount: '0.00',
    date: new Date('2026-11-20T00:00:00Z'),
    direction: 'in',
    vin: [],
    vout: [],
    ...overrides,
  }
}

function renderDetail(tx: WalletTxItem): string {
  return renderToStaticMarkup(
    <ThemeProvider initialTheme={'dark'}>
      <TransactionDetail transaction={tx} onBack={() => {}} />
    </ThemeProvider>
  )
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

describe('TransactionDetail', () => {
  it('does not render a stray 0 when blockHeight is 0', () => {
    const markup = renderDetail(makeTx({ confirmations: 0, blockHeight: 0 }))
    expect(markup).toContain('Confirmations:')
    expect(markup).not.toContain('LockTime:')
    expect(markup).not.toMatch(/<\/div>0<\/div>/)
    expect(stripTags(markup)).toContain('Confirmations:0')
    expect(stripTags(markup)).not.toContain('Confirmations:00')
  })

  it('does not render LockTime when blockHeight is undefined', () => {
    const markup = renderDetail(makeTx({ confirmations: 0, blockHeight: undefined }))
    expect(markup).toContain('Confirmations:')
    expect(markup).not.toContain('LockTime:')
    expect(markup).not.toMatch(/<\/div>0<\/div>/)
    expect(stripTags(markup)).toContain('Confirmations:0')
    expect(stripTags(markup)).not.toContain('Confirmations:00')
  })

  it('renders LockTime block height when blockHeight is positive', () => {
    const markup = renderDetail(makeTx({ status: 'success', confirmations: 6, blockHeight: 12345 }))
    expect(markup).toContain('Confirmations:')
    expect(markup).toContain('LockTime:')
    expect(markup).toContain('Height')
    expect(stripTags(markup)).toContain('LockTime:12345Height')
  })
})
