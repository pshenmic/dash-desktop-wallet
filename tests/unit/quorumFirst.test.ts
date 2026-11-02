import {describe, it, expect} from 'vitest'
import {quorumFirst} from '../../src/main/src/utils/quorumFirst'

const urls = Array.from({length: 40}, (_, i) => `https://10.0.0.${i}:443`)
const quorum = new Set(['10.0.0.3', '10.0.0.17', '10.0.0.29'])

describe('quorumFirst', () => {
  it('puts the validator set ahead of every other evonode', () => {
    expect(new Set(quorumFirst(urls, quorum).slice(0, 3).map(url => new URL(url).hostname))).toEqual(quorum)
  })

  it('matches an IPv6 validator to its bracketed url', () => {
    const v6 = 'https://[2001:db8::7]:443'
    expect(quorumFirst([...urls, v6], new Set(['2001:db8::7']))[0]).toBe(v6)
  })

  it('keeps every evonode exactly once', () => {
    expect([...quorumFirst(urls, quorum)].sort()).toEqual([...urls].sort())
  })

  it('shuffles on every call', () => {
    const orders = new Set(Array.from({length: 5}, () => quorumFirst(urls, new Set()).join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})
