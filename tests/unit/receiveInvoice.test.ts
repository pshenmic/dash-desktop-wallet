import {describe, expect, it} from 'vitest'
import {
  balancedAddressLines,
  corePaymentUri,
  receiveAmountDuffs,
  receiveAmountParam,
  receiveInvoiceHeadline,
  receiveRequestAmountDash,
  wrapByWidth,
} from '../../src/renderer/src/utils/receiveInvoice'

describe('receiveAmountParam', () => {
  it.each([
    ['', null],
    ['.', null],
    ['0', null],
    ['0.000', null],
    ['1.', '1'],
    ['.5', '0.5'],
    ['007.50', '7.5'],
    ['12.34567890', '12.3456789'],
  ])('normalises %j to %j', (amount, expected) => {
    expect(receiveAmountParam(amount)).toBe(expected)
  })

  it('refuses amounts with more than eight decimals or stray characters', () => {
    expect(receiveAmountParam('1.123456789')).toBeNull()
    expect(receiveAmountParam('1.2.3')).toBeNull()
    expect(receiveAmountParam('1e5')).toBeNull()
  })
})

describe('corePaymentUri', () => {
  it('adds the amount and label query parameters when present', () => {
    expect(corePaymentUri('yAddress', null)).toBe('dash:yAddress')
    expect(corePaymentUri('yAddress', '1.5')).toBe('dash:yAddress?amount=1.5')
    expect(corePaymentUri('yAddress', null, 'ZP')).toBe('dash:yAddress?label=ZP')
    expect(corePaymentUri('yAddress', '1.5', 'Coffee & Tea')).toBe('dash:yAddress?amount=1.5&label=Coffee%20%26%20Tea')
    expect(corePaymentUri('yAddress', null, '   ')).toBe('dash:yAddress')
  })
})

describe('receiveAmountDuffs and receiveRequestAmountDash', () => {
  it('converts between Dash input strings and duff bigints', () => {
    expect(receiveAmountDuffs('')).toBeNull()
    expect(receiveAmountDuffs('0')).toBeNull()
    expect(receiveAmountDuffs('1.5')).toBe(150_000_000n)
    expect(receiveRequestAmountDash(150_000_000n)).toBe('1.5')
    expect(receiveRequestAmountDash(null)).toBeNull()
    expect(receiveRequestAmountDash(0n)).toBeNull()
  })
})

describe('receiveInvoiceHeadline', () => {
  it('asks for the amount, or for any amount when none is set', () => {
    expect(receiveInvoiceHeadline('1.5')).toBe('Pay 1.5 Dash')
    expect(receiveInvoiceHeadline(null)).toBe('Any amount')
  })
})

describe('wrapByWidth', () => {
  const width = (line: string): number => line.length

  it('breaks an unspaced address into lines that fit, keeping every character', () => {
    const lines = wrapByWidth([...'abcdefghij'], 4, width)
    expect(lines).toEqual(['abcd', 'efgh', 'ij'])
    expect(lines.join('')).toBe('abcdefghij')
  })

  it('breaks words between words and trims the spaces at the breaks', () => {
    expect(wrapByWidth('Pay 1.5 Dash'.split(/(?<= )/), 8, width)).toEqual(['Pay 1.5', 'Dash'])
  })

  it('keeps a single unit that is wider than the line on its own line', () => {
    expect(wrapByWidth(['abcdef', 'gh'], 4, width)).toEqual(['abcdef', 'gh'])
  })

  it('returns no lines for empty text', () => {
    expect(wrapByWidth([], 4, width)).toEqual([])
  })
})

describe('balancedAddressLines', () => {
  it('keeps Core and Platform addresses on a single line', () => {
    const core = 'ybKB1cXmRoF7BxqVU5H2i9GMEyYjuD9GUn'
    expect(balancedAddressLines(core)).toEqual([core])

    const platform = 'tdash1kpkn7auxuku5z5y3k4tx9ydn6elwmuja0cga5vr4'
    expect(balancedAddressLines(platform)).toEqual([platform])
  })

  it('splits Shielded addresses into two balanced lines', () => {
    const shielded = 'tdash1zqyvt595745255yj6pf2x9nz7y0qhqujdr0dw2qm6ncqtwqexrxg5p2s9abcdef123456'
    const shieldedLines = balancedAddressLines(shielded)
    expect(shieldedLines).toHaveLength(2)
    expect(shieldedLines.join('')).toBe(shielded)
    expect(shieldedLines.every((line) => line.length >= 37 && line.length <= 38)).toBe(true)
  })
})
