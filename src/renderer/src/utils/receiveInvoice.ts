import { DASH_UNIT } from '../constants/balance'
import { RECEIVE_INVOICE_COPY } from '../constants/receiveInvoice'
import { SEND_AMOUNT_PATTERN } from '../constants/sendRecipients'
import { dashToDuffs, davToDash } from './balance'

export function receiveAmountParam(amount: string): string | null {
  if (!SEND_AMOUNT_PATTERN.test(amount)) return null
  const [whole, fraction = ''] = amount.split('.')
  const units = whole.replace(/^0+/, '') || '0'
  const decimals = fraction.replace(/0+$/, '')
  if (units === '0' && decimals === '') return null
  return decimals === '' ? units : `${units}.${decimals}`
}

export function receiveAmountDuffs(amount: string): bigint | null {
  const normalized = receiveAmountParam(amount)
  if (normalized == null) return null
  const duffs = dashToDuffs(normalized)
  return duffs > 0n ? duffs : null
}

export function receiveRequestAmountDash(amountDuffs: bigint | null): string | null {
  if (amountDuffs == null || amountDuffs <= 0n) return null
  return davToDash(amountDuffs)
}

export function corePaymentUri(address: string, amount: string | null, label?: string | null): string {
  const params: string[] = []
  if (amount != null) params.push(`amount=${amount}`)
  const trimmedLabel = label?.trim() ?? ''
  if (trimmedLabel !== '') params.push(`label=${encodeURIComponent(trimmedLabel)}`)
  return params.length === 0 ? `dash:${address}` : `dash:${address}?${params.join('&')}`
}

export function receiveInvoiceHeadline(amount: string | null): string {
  return amount == null ? RECEIVE_INVOICE_COPY.anyAmount : `${RECEIVE_INVOICE_COPY.pay} ${amount} ${DASH_UNIT}`
}

export function wrapByWidth(units: string[], maxWidth: number, measure: (line: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const unit of units) {
    const next = line + unit
    if (line !== '' && measure(next.trimEnd()) > maxWidth) {
      lines.push(line.trimEnd())
      line = unit.trimStart()
    } else {
      line = next
    }
  }
  return line === '' ? lines : [...lines, line.trimEnd()]
}
