import {describe, expect, it} from 'vitest'
import {secp256k1} from '@noble/curves/secp256k1.js'
import {bls12_381} from '@noble/curves/bls12-381.js'
import {bytesToHex, concatBytes, hexToBytes} from '@noble/hashes/utils.js'
import {PrivateKey, Transaction, utils as sdkUtils} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {ProUpRegTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRegTx.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {basicOperatorKey, legacyG1} from '../../src/main/src/utils/masternodeKeys'
import {
  payloadDigest,
  proRegSignString,
  providerInputsHash,
  signedMessageHash,
  signMessage,
} from '../../src/main/src/utils/providerTx'

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

// Testnet ProUpRegTxs (3175fc8a…, e4feb1dc…) and the keyIDOwner of the node each updates.
const UPDATES = [
  {hex: '030003000192a52515eb33fd2e5a41600b34da9833c8eee685f8a02c0262ebe97a846a39ce000000006a47304402206c513173d4e941a93dc6bb62e5bc8207f381a615a2eb5801a120ee83ad5bd40d0220138541be1440a4ac0e9673a2aaa25e67e44884849e44f022d1e6a49fbf0d0a47012102c954446d702d23863e63ccf0c29c9f5e23c6f3cdf2e70e07a5877eba9ba7e53cfeffffff0139a9f505000000001976a9143a39ea82b1f0fc909a3fdd7702de9121e2541c3a88ac00000000e4020092a52515eb33fd2e5a41600b34da9833c8eee685f8a02c0262ebe97a846a39ce00008a5a3ac96d75c412fa90bef0255204ff5ad428c68476b1cb397e3119d30d88cccc76460f4fc3196199f0abee537bc9e59859eafad31e4785fa131f8ef731f8a6361e68911976a91404b08ba1389e8bb0ee2123efa698663df0c8571388ac7478cb331ce82de5ea9a4d0b51456dbe470a7ffa482425b598d6301bc580a9624120ccd785a5264ec54415750bab2498aeeee75e321f142f8165c5367a7d4e72959266aa48a172e4e54ea990067f4507e34fc0651391b3d46fa47f8891be8a35e664', keyIdOwner: 'a4acec053555dbc0d65492fdfb41dcddaeb52c0f'},
  {hex: '0300030001da7649d8c1c48c0499223df3d8cc629ad0c131f12baaa76b78b6f76263c0e85a000000006a473044022068b1200113694c62633f0cb9e3aacb8f68dca35b2694bf8a6c64ac13a8f307510220650bcc29f2094acabea071ba4a6150174bdb911311b7fd82c5d19fa6b28d6097012102c954446d702d23863e63ccf0c29c9f5e23c6f3cdf2e70e07a5877eba9ba7e53cfeffffff01f81cf505000000001976a9143a39ea82b1f0fc909a3fdd7702de9121e2541c3a88ac00000000e40200aec208a41915cdbaa027f592408cb915d6aeac2dbb1177cf1c67bc98df6f62b20000a334883b2a84f96be809d884b36eb4b4f40975357b291ff504aceac6457fecb1cfe5f9d9d45fbc518cc19493a253580bbbc99516dfc15780b31b03d1462eb7d0e80282671976a9146e6c9189021b6e38326dff6886104054a110990d88acf25de22cedc67ee09c0cb4ccfe281deef0270fa95c134ea9e75222d1e31b3c6f411f67d0fa8687c96d9207a99ca210c5f9cf7996eea4b72a8f165e576696d43bf72e37e86c66abdd79475b883072fd155c11559f073405fea2bd751288ee7a4dd710', keyIdOwner: 'b72320db0cf2899cd3c656f25992cadb9f7efa3a'},
]

function signer(signature: Uint8Array, hash: Uint8Array): string {
  const recovered = concatBytes(Uint8Array.of((signature[0] - 27) & 3), signature.slice(1))
  return keyPair.p2pkhAddress(secp256k1.recoverPublicKey(recovered, hash, {prehash: false}), 'testnet')
}

describe.each([['v1 Regular', REGULAR], ['v2 Evo', EVO]])('%s ProRegTx', (_, vector) => {
  const tx = Transaction.fromHex(vector.hex)
  const payload = tx.extraPayload as ProRegTX

  it('hashes its inputs into inputsHash', () => {
    expect(providerInputsHash(tx.inputs.map(input => ({txId: input.txId, vOut: input.vOut})))).toBe(payload.inputsHash)
  })

  it('was signed over our sign string by the collateral key', () => {
    expect(signer(hexToBytes(payload.payloadSig), signedMessageHash(proRegSignString(payload, 'testnet')))).toBe(vector.collateralAddress)
  })
})

describe('signMessage', () => {
  it('produces a compressed-key compact signature its own key recovers from', () => {
    const key = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'testnet', true)
    const signature = signMessage('a|0|b|c|d', key.key)
    expect(signature.length).toBe(65)
    expect(signature[0]).toBeGreaterThanOrEqual(31)
    expect(signer(signature, signedMessageHash('a|0|b|c|d'))).toBe(key.getAddress())
  })
})

describe.each(UPDATES)('ProUpRegTx %#', ({hex, keyIdOwner}) => {
  const tx = Transaction.fromHex(hex)
  const payload = tx.extraPayload as ProUpRegTx

  it('hashes its inputs into inputsHash', () => {
    expect(providerInputsHash(tx.inputs)).toBe(payload.inputsHash)
  })

  it('was signed over the payload hash itself by the owner key', () => {
    expect(signer(hexToBytes(payload.payloadSig), payloadDigest(payload)))
      .toBe(sdkUtils.publicKeyHashToAddress(hexToBytes(keyIdOwner), 'testnet'))
  })
})

describe('basicOperatorKey', () => {
  const keyWithSign = (sign: boolean): Uint8Array => {
    for (let scalar = 1n; ; scalar++) {
      const key = bls12_381.G1.Point.BASE.multiply(scalar).toBytes(true)
      if (((key[0] & 0x20) !== 0) === sign) return key
    }
  }

  it('reads back a legacy key whose y-sign is clear', () => {
    const basic = keyWithSign(false)
    expect(basicOperatorKey(bytesToHex(legacyG1(basic)))).toBe(bytesToHex(basic))
  })

  it('passes a basic key whose y-sign is set', () => {
    const basic = bytesToHex(keyWithSign(true))
    expect(basicOperatorKey(basic)).toBe(basic)
  })

  it('refuses a key either encoding could have produced', () => {
    expect(() => basicOperatorKey(bytesToHex(keyWithSign(false)))).toThrow('either BLS encoding')
  })
})
