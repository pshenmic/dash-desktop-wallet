import {describe, expect, it} from 'vitest'
import {secp256k1} from '@noble/curves/secp256k1.js'
import {concatBytes, hexToBytes} from '@noble/hashes/utils.js'
import {PrivateKey, Transaction} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {
  proRegInputsHash,
  proRegSignString,
  signedMessageHash,
  signMessage,
} from '../../src/main/src/utils/proRegTx'

// Testnet ProRegTxs with external collateral, mined and so accepted by consensus:
// a v1 Regular (proTxHash 9adf0204…) and a v2 Evo (f5032440…).
const REGULAR = {
  hex: '03000100015e09a967f881113c81812102e3d365e6573b7269ff1613c7110d058e24ea1236000000006b483045022100e85c03eb232d0124ed02c6419ff502daa2fb88b2ccc6d2c9f1555c1d7246f12602201490c3495bd16b46dd37a7aab3767ef87385ccfab5710311cfaf6f7f2104732e012103c57d5e2d9fa87563e5c0b98e813b1f00c95f98b40c43c1b340d7be246151c52afeffffff013b179800000000001976a91427aec5b42d8d74dd11d216bd2628111c4d9fccda88ac00000000fd12010100000000005e09a967f881113c81812102e3d365e6573b7269ff1613c7110d058e24ea12360100000000000000000000000000ffff4e2eb95e4e1fa7889dad2c33e1f6b8b68aa5cbb7392d9e96bdee0df074095e5498c6f1b76508c3ae700484d8b0d5cd12a990f3dd54e35b47d6fc943af4223d390ddaf8989d883c84b284a7889dad2c33e1f6b8b68aa5cbb7392d9e96bdeee8031976a91427aec5b42d8d74dd11d216bd2628111c4d9fccda88ac295849505de71fa14fe9df9c33536db0cea35ea231f48ded38cb8c9d76a89c034120459600b6074cdb1185d7247bca393ebd9354145d23a064f32fb30177ae53122809f6c8cbbcb538c360cfee85da03b736eb95f5b3283804d20ae0d5d57302c881',
  collateralAddress: 'yXzZoGPzrC7fgsFQvZTFjbf8iwms5dZ1A4',
}
const EVO = {
  hex: '0300010001f28355c3d903ba00dcca13ae433f1c17bc1a21944b2228e27049b153599072b0000000006a4730440220587f4ec10b8aa3b26b3dcac7741ad94b8e04e058a84fbe904501a827db784e0802204061771f8b1db990aea28d8f8734757ad19b1783d8a552a3d6d49415742ad52d01210263eadabd45029875a4782289c78ebe2acebdd826e27f1671d39c2cb6892d946bfeffffff010ac89a3b000000001976a914bf67cd9966b2f5b6f6734750402c3e08a7592ad688ac00000000fd2a01020001000000fbb5dcd847624e40c7f3accd2df6eacd5c3bec9c1b09c0756c833ae58707140e0100000000000000000000000000ffffa74708d24e1f2ae1197ce23005bb49c31235dc4aa1814d7147a98b680da2d89a12891c9b797552c2edfb7dd89047f0ccf9e8a62613d03e9e3baa96ecdf20090371adf72c3e3bf306dcd62ae1197ce23005bb49c31235dc4aa1814d7147a900001976a914bf67cd9966b2f5b6f6734750402c3e08a7592ad688ac2cea8ba4c21da5c218169293756bc31b18e7236041ce5d1e0d540216050dbb4c5b6ddd9532c5863b8bb113ef92d77f77b66f859b308fa305411f4ea5ebb7aa47b402d210c71fffac06661449198fe3cdf766070ea30226598c8f71df515a466b85d68246527fcd0283bf5fdf04e670c4abe95ecc09581f71cef0',
  collateralAddress: 'yMehWJgHg1iLmn4iCWQx5jQtsTpPZcMgPP',
}

const keyPair = new KeyPairController()

function signer(signature: Uint8Array, message: string): string {
  const recovered = concatBytes(Uint8Array.of((signature[0] - 27) & 3), signature.slice(1))
  return keyPair.p2pkhAddress(secp256k1.recoverPublicKey(recovered, signedMessageHash(message), {prehash: false}), 'testnet')
}

describe.each([['v1 Regular', REGULAR], ['v2 Evo', EVO]])('%s ProRegTx', (_, vector) => {
  const tx = Transaction.fromHex(vector.hex)
  const payload = tx.extraPayload as ProRegTX

  it('hashes its inputs into inputsHash', () => {
    expect(proRegInputsHash(tx.inputs.map(input => ({txId: input.txId, vOut: input.vOut})))).toBe(payload.inputsHash)
  })

  it('was signed over our sign string by the collateral key', () => {
    expect(signer(hexToBytes(payload.payloadSig), proRegSignString(payload, 'testnet'))).toBe(vector.collateralAddress)
  })
})

describe('signMessage', () => {
  it('produces a compressed-key compact signature its own key recovers from', () => {
    const key = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'testnet', true)
    const signature = signMessage('a|0|b|c|d', key.key)
    expect(signature.length).toBe(65)
    expect(signature[0]).toBeGreaterThanOrEqual(31)
    expect(signer(signature, 'a|0|b|c|d')).toBe(key.getAddress())
  })
})
