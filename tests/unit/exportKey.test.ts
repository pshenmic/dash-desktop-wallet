import { describe, expect, it } from 'vitest'
import { formatAddressKey } from '@renderer/utils/exportKey'

describe('formatAddressKey', () => {
  it('encodes raw public and private key bytes as lowercase hex', () => {
    const formatted = formatAddressKey({
      address: 'XekiLaxnqpFb2m4NQAEcsKutZcZgcyfo6W',
      path: "m/44'/5'/0'/0/0",
      wif: 'XKeyWif',
      privateKey: Uint8Array.from([0x00, 0xab, 0xff]),
      publicKey: Uint8Array.from([0x02, 0x10, 0xcd]),
    })

    expect(formatted).toEqual({
      address: 'XekiLaxnqpFb2m4NQAEcsKutZcZgcyfo6W',
      path: "m/44'/5'/0'/0/0",
      wif: 'XKeyWif',
      privateKeyHex: '00abff',
      publicKeyHex: '0210cd',
    })
  })
})
