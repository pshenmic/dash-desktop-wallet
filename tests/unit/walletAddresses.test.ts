import {describe, it, expect} from 'vitest'
import {walletAddresses} from '../../src/main/src/utils/walletAddresses'
import type {Address} from '../../src/main/src/types/Address'

const address = (name: string): Address => ({
  walletId: 'w',
  accountId: 0,
  address: name,
  derivationPath: `m/${name}`,
  index: 0,
  isChange: false,
  isUsed: false,
  label: null,
})

describe('walletAddresses', () => {
  it('covers both BIP-44 chains and the DashPay chains', () => {
    const grouped = {
      receiving: [address('r1')],
      change: [address('c1')],
      dashPay: [address('d1'), address('d2')],
    }

    expect(walletAddresses(grouped).map(a => a.address)).toEqual(['r1', 'c1', 'd1', 'd2'])
  })

  it('answers for a wallet without DashPay chains', () => {
    const grouped = {receiving: [address('r1')], change: []}
    expect(walletAddresses(grouped).map(a => a.address)).toEqual(['r1'])
  })

  it('answers empty for a wallet with no addresses', () => {
    expect(walletAddresses({receiving: [], change: []})).toEqual([])
  })
})
