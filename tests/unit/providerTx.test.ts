import {describe, expect, it} from 'vitest'
import {secp256k1} from '@noble/curves/secp256k1.js'
import {bls12_381} from '@noble/curves/bls12-381.js'
import {bytesToHex, concatBytes, hexToBytes} from '@noble/hashes/utils.js'
import {PrivateKey, Transaction, utils as sdkUtils} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {ProUpRegTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRegTx.js'
import {ProUpServTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpServTx.js'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {getCompactVariableSize} from 'dash-core-sdk/src/utils.js'
import {basicOperatorKey, legacyG1} from '../../src/main/src/utils/masternodeKeys'
import {
  payloadDigest,
  proRegSignString,
  providerInputsHash,
  providerPayloadBytes,
  requireProTxHash,
  requireRegistrationFields,
  requireServiceUpdate,
  serviceAddressParts,
  signBls,
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

  it('hashes and prices the unsigned payload as it went out signed', () => {
    const unsigned = Object.assign(Object.create(Object.getPrototypeOf(payload)), payload, {payloadSig: ''})
    const signed = payload.bytes().length
    expect(payloadDigest(unsigned)).toEqual(payloadDigest(payload))
    expect(providerPayloadBytes(unsigned)).toBe(signed + getCompactVariableSize(signed))
  })

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

  it('hashes and prices the unsigned payload as it went out signed', () => {
    const unsigned = Object.assign(Object.create(Object.getPrototypeOf(payload)), payload, {payloadSig: ''})
    const signed = payload.bytes().length
    expect(payloadDigest(unsigned)).toEqual(payloadDigest(payload))
    expect(providerPayloadBytes(unsigned)).toBe(signed + getCompactVariableSize(signed))
  })

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

// Testnet ProUpServTxs (Regular and Evo, all v3 since v24 is active there) and
// ProUpRevTxs, with the operator key each was signed by.
const OPERATOR_SIGNED = [
  {txid: '744dd6ad', operatorPublicKey: 'adad41e17d64581f58fcbc8dff2845a9a10c2e57db782dc5fd41a175729e59048dc3fb82d9f0620eeaac3eacadced01a',
    hex: '0300020001d455c2442d52a70e1020f4c8d9d4703b8ac0f1de8c07209ddcc94d9d91c8407b000000006a47304402203e281a24acc3a6cbebfc34f2438f465ba74f924ad15b590c2b6816d317e45fbc02201b56d995828436eff75a00526445ed3d88ffd4c5dd19db93730b7c6c5e8c2724012103373b1a2246e5c28ce99c49a927fa3f8823bb5e26d9b037ff1069dcae3ba4cf4afeffffff019480c35f000000001976a91418d05f474a776383ac3aebbfb978ae29da144ed088ac00000000b20300000082607466905f4091ec6db6df160559605139b246282485a548f4ea38255da1e6010100010101044e1146af4dbb005284d2886455107aa20f1a53166d32f30834a659c5df036630ec46499edc3935a6fda8e649ccd68bfeacc58cf348637ae92f31372dd5637c378cd0bba0012c664d1ad592047b53914b7d9cb34e6181ed0e4a76ac95c6f83969421f9c05086c06c0e838a96d004d21c2367e15c3c99d9bb1e8915012cc7ed65b7df2ad39674fea'},
  {txid: '7b40c891', operatorPublicKey: 'ad99da4a07542b221fa6f2335ab2a1071cad6f2dbae230fe82a619b07d039b6270632272ea7269dc5c8241eef139f57c',
    hex: '030002000182607466905f4091ec6db6df160559605139b246282485a548f4ea38255da1e6000000006a47304402203a2c5d6e018ea40f8802821e532d0a98671a2ffc3cb89cc756b688fda92b24c00220594c926e883e3d252e4f8a0b665ec55951253f1992ee361913b5554947fe713a012103373b1a2246e5c28ce99c49a927fa3f8823bb5e26d9b037ff1069dcae3ba4cf4afeffffff011082c35f000000001976a91418d05f474a776383ac3aebbfb978ae29da144ed088ac00000000dc03000100800b5c82dde5ef1694b17d0a93dfd03ca8a49c1c31512457e78396f79fa23c7601030001010104a223f3554e1d0101010104a223f3558f300201010104a223f35505a30051fbafb6fee2545980ea4759dda3032a15562ac2730c4080490852c5e983447fc92e0ebc2cf6df05de73b3a9821e9c590420d033a7c591322f3285b9073d5733741306cf9174757ecfb4bc49355545b359ffb0086fea231bf214cb7842ad6c1f8bd991d103be60f926d71a29cf632bab1ee3ecc99a79556842b67cc966a70ef3fca6e4deb7023f6f126592ae1ee24c2b8dff75a3'},
  {txid: '92a94878', operatorPublicKey: 'b6693296894820bdc3c0ae76f357e544847f10a68f0046f53745370dbe861d57e194ddaf7ff7d5e73cc3f240515c448e',
    hex: '0300020001559c0f3b03af9d416a2e72eb749547d77169cb04fcfaeb0a14057eabc88d24ed000000006a47304402205060653ff31da446735a21845c40feb2d0627f6791e43d35fc605ea9a134fa23022020107839f5a9e08e05db66c87aa56b690ace0a50ea55adaf05814e0e5284425f0121024cc4973b7f20a9282deb930af896892be43b2b462a30c98b9ff9f8a2622d88fefeffffff010c8ef405000000001976a91454331ff5356c8a834bc40ec241aacfae8bf5c54e88ac00000000dc030001004abd3d9b76a34d428159456a2e9722036c2de8da9ef138e7e191d73dd81a74390103000101010444437a164e1f010101010444437a168f30020101010444437a1605a300791faa35b83b603c754a39d2a7c9f12d7e33945ca2137f3c924e9ee7e8f30d76b4563e764e296ef17cbb808ca3ed72bcb9f37bec98b7937c11607288938362cfdd5036d01c2f25c7c9a286360590f0b76b902e82484d72a7a93f37becb7d670ed4b1e95a0fe7eeae72e9361ab2abc2816b1d862fc9def98dab3ccc54eb82bca8c42ba37593fb0cf76008ae15635da4c612020c26'},
  {txid: 'e65c3539', operatorPublicKey: 'b1f9052f62561db112ddca7df3d914d546866b130124eccb2ae1e8419563e51f239b2efec3d1b3fd388072610939d694',
    hex: '0300020001df9f071cb742b9c0fd882f87679eb566625b355eaf3848a9b07449f6ba9dc8b6000000006a473044022068c796010321a59a5b48743ec6355fbc1c0ebe8d82a51afd117c765fb40b255b02204babad07605e54e7aa8080176da3230aa768c6b6ce571434dde0c737820356c3012102b11bf0c233c8ffca382542a37a981fead1d114bc8dfd2779727b08b864c910a3feffffff01deddf505000000001976a91447eb59e9a49b3794acf272f1bfff17f228291daf88ac00000000b203000000aad381e4314f1630559db598be088232973e6c9ab61e7da181272675fa70ee720101000101010444437a434e1f00b853365843057353b98b30412d08d1e5c58cbbbc46b44c5ab86c08f54e84da409734538b10302c781370765f1ebff8be6ea4f3d68b311e56c20a843558d6fa37374908c1d041c7ca748b2fcf0a4d68e3147fc4333931a79a1f9738afefaa76d35c7ae4809c4ac0d0aaace8f79e1b6c8b904553430bc24628470235aaa813d25d'},
  {txid: '5b22bfff', operatorPublicKey: '99c825dac0553e4ab11a441f9ceae265254303d9c8ad50c4cfc36211449613d7269307c7d94a6903e0818a25e6a5607f',
    hex: '03000400015498415f488cd005f5c4a0d44afa056054f0563fa2ef282dc8eaa33772fff4ba000000006a47304402206d187174c4e0ac2d496c1dedd098af84b998979e9538d762cd5d812899b7961d022054bda6dbc2fb8fc3c70766bcf0aabb1fcfe777d4a5fc0feacb85159787c98d8101210389c2bc8088d56da1f940db47a0c25ba3fb53ffb540a7e347bd6b6275d4ab4bcffeffffff01f31e023b000000001976a9144e0c37c67b0bf8d9cd52da576437a92379dfb40488ac00000000a40300e31fadad3c2dd7247ce1aa7efba75dcfc1c4bcc2a14a9a71182f51afe9f3bece00005f203c3b95b819eb5c6a0550bd3074db8d16adbcc9a4a1a349a9eb35bf585eec8a951f933698a7d6544addd7394dcb83244d02e2f1982c490cc2bb7b7fc377e1c3486daf6b6455c648d9c76f4a9bb91502ee34760c7678724bf98aeaa7941606453657a718183ffad86ab3b48105762c1b478f933cd7a300051a09be8b661f06'},
  {txid: 'a0477146', operatorPublicKey: '8699a2bd842a175191e534503bd9732d28f8d3580a1d3f802c6e45ec33976942f5a5753d9cff216e4ca8e490b69abe0c',
    hex: '030004000176e01d2dbf0b6ba5e7a61bcd45d6df112e9472cb7c7ac220b4551504abd99ac8000000006a47304402200d06f373a2b9133ca2816a7c047bf4316300d8d13ad002829345f6c145afae9c02203aab1c8ac4bcfe10ac42fcd040eee4c789b9190eb3743b5306ce9ccb8a86999901210389c2bc8088d56da1f940db47a0c25ba3fb53ffb540a7e347bd6b6275d4ab4bcffeffffff018317023b000000001976a9144e0c37c67b0bf8d9cd52da576437a92379dfb40488ac00000000a40300499f136ec3e87499770c98e991b6084822d3ee78472e39f1d8ebca17ad3ceb5a0000c126fb5552fa4be0d7dd02dc685ef80aeb42c9bd4f6f1ab59ede1d64e69b5d3b95ba4190ac6e7cd13b6c54f52912ccfaae7d46fd40ac32de59b4d9906b3e4628273dfaf4145ee619c58a5a5697a08c7b15458291e476d96b8ccaefb68a68a27eb78d57578895948a29ea1d6a4d0e6e520db52d3c4f82f2cfc84cc561e98f77af'},
]

const verifyBls = (signature: string, hash: Uint8Array, publicKey: string): boolean => {
  const {longSignatures} = bls12_381
  return longSignatures.verify(hexToBytes(signature), longSignatures.hash(hash), hexToBytes(publicKey))
}

describe.each(OPERATOR_SIGNED)('operator-signed $txid', ({hex, operatorPublicKey}) => {
  const tx = Transaction.fromHex(hex)
  const payload = tx.extraPayload as ProUpServTx

  it('hashes its inputs into inputsHash', () => {
    expect(providerInputsHash(tx.inputs)).toBe(payload.inputsHash)
  })

  it('was BLS-signed over the payload hash by the operator key', () => {
    expect(verifyBls(payload.payloadSig, payloadDigest(payload), operatorPublicKey)).toBe(true)
  })

  const unsigned = Object.assign(Object.create(Object.getPrototypeOf(payload)), payload, {payloadSig: ''})

  it('hashes and prices the unsigned payload as it went out signed', () => {
    const signed = payload.bytes().length
    expect(payloadDigest(unsigned)).toEqual(payloadDigest(payload))
    expect(providerPayloadBytes(unsigned)).toBe(signed + getCompactVariableSize(signed))
  })
})

describe('proUpServPayload', () => {
  it('rebuilds a testnet Evo service update byte for byte', () => {
    const mined = Transaction.fromHex(OPERATOR_SIGNED[1].hex).extraPayload as ProUpServTx
    const built = new CoreTransactionService().proUpServPayload('Evo', mined.proTxHash, {
      serviceAddress: '162.35.243.85:19997',
      operatorPayoutAddress: null,
      platformNodeId: mined.platformNodeID!,
      platformP2PPort: 36656,
      platformHttpPort: 1443,
    }, 'testnet')
    built.inputsHash = mined.inputsHash
    built.payloadSig = mined.payloadSig
    expect(bytesToHex(built.bytes())).toBe(bytesToHex(mined.bytes()))
  })
})

describe('signBls', () => {
  it('signs in the scheme the mined operator signatures verify under', () => {
    const secret = new Uint8Array(32).fill(9)
    const publicKey = bytesToHex(bls12_381.longSignatures.getPublicKey(secret).toBytes(true))
    const hash = new Uint8Array(32).fill(1)
    expect(verifyBls(bytesToHex(signBls(hash, secret)), hash, publicKey)).toBe(true)
  })
})

describe('serviceAddressParts', () => {
  it('takes a public IPv4 address on the port its network allows', () => {
    expect(serviceAddressParts('1.2.3.4:19999', 'testnet')).toEqual({ip: '1.2.3.4', port: 19999})
    expect(serviceAddressParts(' 1.2.3.4:9999 ', 'mainnet')).toEqual({ip: '1.2.3.4', port: 9999})
  })

  it('refuses mainnet\'s Core port off mainnet, and any other port on it', () => {
    expect(() => serviceAddressParts('1.2.3.4:9999', 'testnet')).toThrow("Port 9999 is mainnet's")
    expect(() => serviceAddressParts('1.2.3.4:19999', 'mainnet')).toThrow('serves on port 9999')
  })

  it.each(['10.0.0.1', '172.16.5.5', '192.168.1.1', '127.0.0.1', '0.1.2.3', '100.64.0.1', '169.254.1.1',
    '198.18.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '255.255.255.255'])('refuses %s, which Core cannot route', ip => {
    expect(() => serviceAddressParts(`${ip}:19999`, 'testnet')).toThrow('not a public address')
  })

  it.each(['1.2.3.4', '1.2.3.4:', '1.2.3:19999', '1.2.3.256:19999', '1.2.3.4:0', '1.2.3.4:70000', '[::1]:19999', 'host:19999'])(
    'refuses %s, which is not IPv4 and a port', value => {
      expect(() => serviceAddressParts(value, 'testnet')).toThrow('Not an IPv4 address and port')
    })
})

describe('provider tx field checks', () => {
  const NODE_ID = '5b6ddd9532c5863b8bb113ef92d77f77b66f859b'
  const evo = {serviceAddress: '1.2.3.4:19999', operatorPayoutAddress: null, platformNodeId: NODE_ID, platformP2PPort: 36656, platformHttpPort: 1443}

  it('takes a well-formed Evo service', () => {
    expect(() => requireServiceUpdate('Evo', evo, 'testnet')).not.toThrow()
    expect(() => requireServiceUpdate('Evo', {...evo, serviceAddress: '1.2.3.4:9999', platformP2PPort: 26656, platformHttpPort: 443}, 'mainnet')).not.toThrow()
  })

  it('holds a mainnet Evo to the default platform ports', () => {
    expect(() => requireServiceUpdate('Evo', {...evo, serviceAddress: '1.2.3.4:9999'}, 'mainnet')).toThrow('26656 (P2P) and 443 (HTTP)')
  })

  it('refuses the Core port as a platform port, and ports that collide', () => {
    expect(() => requireServiceUpdate('Evo', {...evo, platformHttpPort: 9999}, 'testnet')).toThrow('cannot be a platform port')
    expect(() => requireServiceUpdate('Evo', {...evo, platformHttpPort: 36656}, 'testnet')).toThrow('must all differ')
    expect(() => requireServiceUpdate('Evo', {...evo, platformP2PPort: 19999}, 'testnet')).toThrow('must all differ')
  })

  it('refuses a zero or malformed platform node id, and platform fields on a Regular node', () => {
    expect(() => requireServiceUpdate('Evo', {...evo, platformNodeId: '0'.repeat(40)}, 'testnet')).toThrow('platform node id')
    expect(() => requireServiceUpdate('Evo', {...evo, platformNodeId: 'xyz'}, 'testnet')).toThrow('platform node id')
    expect(() => requireServiceUpdate('Regular', evo, 'testnet')).toThrow('Evo masternodes only')
  })

  it('refuses a registration with a malformed collateral or reward', () => {
    const registration = {
      type: 'Regular' as const, collateral: {txid: 'cc'.repeat(32), vout: 0}, serviceAddress: null, payoutAddress: 'y',
      operatorReward: 0, platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    }
    expect(() => requireRegistrationFields(registration, 'testnet')).not.toThrow()
    expect(() => requireRegistrationFields({...registration, collateral: {txid: 'cc', vout: 0}}, 'testnet')).toThrow('txid and an output index')
    expect(() => requireRegistrationFields({...registration, collateral: {txid: 'cc'.repeat(32), vout: -1}}, 'testnet')).toThrow('txid and an output index')
    expect(() => requireRegistrationFields({...registration, operatorReward: 10_001}, 'testnet')).toThrow('Operator reward')
    expect(() => requireRegistrationFields({...registration, serviceAddress: '10.0.0.1:19999'}, 'testnet')).toThrow('not a public address')
  })

  it('refuses a proTxHash that is not 32 bytes of hex', () => {
    expect(() => requireProTxHash('ab'.repeat(32))).not.toThrow()
    expect(() => requireProTxHash('ab')).toThrow('Not a proTxHash')
  })
})
