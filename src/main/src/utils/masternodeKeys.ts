import {bls12_381, bls12_381_Fr as Fr} from '@noble/curves/bls12-381.js'
import {ed25519} from '@noble/curves/ed25519.js'
import {bytesToNumberBE, numberToBytesBE} from '@noble/curves/utils.js'
import {hmac} from '@noble/hashes/hmac.js'
import {sha256, sha512} from '@noble/hashes/sha2.js'
import {bytesToHex, concatBytes, hexToBytes, utf8ToBytes} from '@noble/hashes/utils.js'
import {HARDENED_OFFSET, HDKey} from '@scure/bip32'
import {PrivateKey} from 'dash-core-sdk'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {
  BLS_HD_SEED_KEY,
  COIN_TYPE,
  ED25519_SEED_KEY,
  HD_VERSIONS,
  MASTERNODE_FEATURE,
  MASTERNODE_KEY_ROLE,
  MASTERNODE_PLATFORM_KEY_BATCH,
} from '../constants/addresses'
import {AddressDeriver} from '../types/AddressWindow'
import {ExtendedSecretKey, MasternodeKeyChain, MasternodeKeyRole, MasternodeKeys} from '../types/Masternode'
import {Network} from '../types/Network'

const G1 = bls12_381.G1.Point
const keyPair = new KeyPairController()

function accountLevels(network: Network, role: MasternodeKeyRole): number[] {
  return [9, COIN_TYPE[network], MASTERNODE_FEATURE, MASTERNODE_KEY_ROLE[role]]
}

export function masternodeAccountPath(network: Network, role: MasternodeKeyRole): string {
  return `m/${accountLevels(network, role).map(level => `${level}'`).join('/')}`
}

// dashbls splits one derivation step into two HMAC-SHA256 calls, suffixed 0 for
// the key and 1 for the chain code, and reduces the key mod r before it is
// hashed into the next step.
function blsStep(key: Uint8Array, data: Uint8Array): ExtendedSecretKey {
  const [privateKey, chainCode] = [0, 1].map(suffix => hmac(sha256, key, concatBytes(data, Uint8Array.of(suffix))))
  return {privateKey: Fr.toBytes(Fr.fromBytes(privateKey)), chainCode}
}

// Unlike secp256k1 BIP32, a hardened BLS step has no 0x00 before the key.
function blsHardenedChild({privateKey, chainCode}: ExtendedSecretKey, level: number): ExtendedSecretKey {
  const step = blsStep(chainCode, concatBytes(privateKey, numberToBytesBE(level + HARDENED_OFFSET, 4)))
  return {privateKey: Fr.toBytes(Fr.add(Fr.fromBytes(privateKey), Fr.fromBytes(step.privateKey))), chainCode: step.chainCode}
}

// Dash's pre-basic-scheme G1 encoding: the y-sign flag moves to the top bit and
// the compression flag is dropped. dashbls hashes this form for operator keys,
// and registrations made before the switch still carry it.
export function legacyG1(publicKey: Uint8Array): Uint8Array {
  // Not slice(): on a Buffer read back from SQLite that is a view, and the
  // caller's key would be rewritten.
  const legacy = Uint8Array.from(publicKey)
  legacy[0] = (publicKey[0] & 0x1f) | ((publicKey[0] & 0x20) << 2)
  return legacy
}

export function requireBasicOperatorKey(publicKey: string): string {
  try {
    G1.fromBytes(hexToBytes(publicKey))
  } catch {
    throw new Error(`Not a BLS public key: ${publicKey}`)
  }
  return publicKey.toLowerCase()
}

// A list prints a legacy-state node's key in the legacy encoding. Legacy never
// sets 0x20, x being under 381 bits, and basic always sets 0x80, so a key with
// 0x80 set and 0x20 clear reads either way and is refused rather than guessed.
export function basicOperatorKey(listed: string): string {
  const bytes = hexToBytes(listed)
  if ((bytes[0] & 0x80) !== 0 && (bytes[0] & 0x20) === 0) {
    throw new Error('The listed operator key may be in either BLS encoding; pass it explicitly')
  }
  bytes[0] |= 0x80
  return requireBasicOperatorKey(bytesToHex(bytes))
}

export function operatorPublicKey(accountPublicKey: Uint8Array, chainCode: Uint8Array, index: number): Uint8Array {
  const tweak = blsStep(chainCode, concatBytes(legacyG1(accountPublicKey), numberToBytesBE(index, 4))).privateKey
  return G1.fromBytes(accountPublicKey).add(G1.BASE.multiply(Fr.fromBytes(tweak))).toBytes(true)
}

function slip10Child({privateKey, chainCode}: ExtendedSecretKey, level: number): ExtendedSecretKey {
  const I = hmac(sha512, chainCode, concatBytes(Uint8Array.of(0), privateKey, numberToBytesBE(level + HARDENED_OFFSET, 4)))
  return {privateKey: I.slice(0, 32), chainCode: I.slice(32)}
}

// Tenderdash's node id, which ProRegTx carries as platformNodeID — not hash160.
export function platformNodeId(publicKey: Uint8Array): Uint8Array {
  return sha256(publicKey).slice(0, 20)
}

export function masternodeKeys(seed: Uint8Array, network: Network): MasternodeKeys {
  const root = HDKey.fromMasterSeed(seed, HD_VERSIONS[network])
  const operator = accountLevels(network, 'operator').reduce(blsHardenedChild, blsStep(utf8ToBytes(BLS_HD_SEED_KEY), seed))
  const ed25519Master = hmac(sha512, utf8ToBytes(ED25519_SEED_KEY), seed)
  const platformAccount = accountLevels(network, 'platformNode')
    .reduce(slip10Child, {privateKey: ed25519Master.slice(0, 32), chainCode: ed25519Master.slice(32)})

  return {
    votingXpub: root.derive(masternodeAccountPath(network, 'voting')).publicExtendedKey,
    ownerXpub: root.derive(masternodeAccountPath(network, 'owner')).publicExtendedKey,
    operatorPublicKey: G1.BASE.multiply(Fr.fromBytes(operator.privateKey)).toBytes(true),
    operatorChainCode: operator.chainCode,
    platformNodeKeys: Array.from({length: MASTERNODE_PLATFORM_KEY_BATCH},
      (_, index) => ed25519.getPublicKey(slip10Child(platformAccount, index).privateKey)),
  }
}

// One provider key chain of the stored account keys. Owner and voting keys are
// listed by their P2PKH address, operator keys by their hex public key.
export function masternodeKeyDeriver(keys: MasternodeKeys, network: Network, chain: MasternodeKeyChain): AddressDeriver {
  const accountPath = masternodeAccountPath(network, chain)
  const account = chain === 'operator' ? null : HDKey.fromExtendedKey(chain === 'owner' ? keys.ownerXpub : keys.votingXpub, HD_VERSIONS[network])
  return {
    derive: index => ({
      index,
      address: account == null
        ? bytesToHex(operatorPublicKey(keys.operatorPublicKey, keys.operatorChainCode, index))
        : keyPair.p2pkhAddress(account.deriveChild(index).publicKey!, network),
      derivationPath: `${accountPath}/${index}`,
    }),
  }
}

// An imported provider key in the form the list is searched by: an owner or
// voting WIF becomes its address, an operator's hex secret its public key.
export function masternodePublicKey(role: MasternodeKeyChain, privateKey: string, network: Network): string {
  if (role === 'operator') {
    const secret = hexToBytes(privateKey)
    if (secret.length !== 32 || !Fr.isValidNot0(bytesToNumberBE(secret))) throw new Error('Not a BLS secret key')
    return bytesToHex(G1.BASE.multiply(bytesToNumberBE(secret)).toBytes(true))
  }
  const key = PrivateKey.fromWIF(privateKey)
  // A WIF re-encodes to itself only on the network it was made for.
  if (PrivateKey.fromBytes(key.bytes(), network, key.compressed).toWIF() !== privateKey) {
    throw new Error(`Not a ${network} private key`)
  }
  return key.getAddress()
}
