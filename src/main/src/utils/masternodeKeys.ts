import {bls12_381} from '@noble/curves/bls12-381.js'
import {ed25519} from '@noble/curves/ed25519.js'
import {numberToBytesBE} from '@noble/curves/utils.js'
import {hmac} from '@noble/hashes/hmac.js'
import {sha256, sha512} from '@noble/hashes/sha2.js'
import {bytesToHex, concatBytes, hexToBytes, utf8ToBytes} from '@noble/hashes/utils.js'
import {HARDENED_OFFSET, HDKey} from '@scure/bip32'
import {bls, PrivateKey} from 'dash-core-sdk'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {
  COIN_TYPE,
  ED25519_SEED_KEY,
  HD_VERSIONS,
  MASTERNODE_FEATURE,
  MASTERNODE_KEY_ROLE,
  MASTERNODE_PLATFORM_KEY_BATCH,
} from '../constants/addresses'
import {AddressDeriver} from '../types/AddressWindow'
import {ExtendedSecretKey, MasternodeKeyChain, MasternodeKeyFilter, MasternodeKeyRole, MasternodeKeys} from '../types/Masternode'
import {Network} from '../types/Network'

const G1 = bls12_381.G1.Point
const keyPair = new KeyPairController()

function accountLevels(network: Network, role: MasternodeKeyRole): number[] {
  return [9, COIN_TYPE[network], MASTERNODE_FEATURE, MASTERNODE_KEY_ROLE[role]]
}

export function masternodeAccountPath(network: Network, role: MasternodeKeyRole): string {
  return `m/${accountLevels(network, role).map(level => `${level}'`).join('/')}`
}

// Unlike the SDK's toBasicPublicKey, an external key is taken as basic even when
// its flags read as either encoding: the user pastes what their operator tool shows.
export function requireBasicOperatorKey(publicKey: string): string {
  try {
    G1.fromBytes(hexToBytes(publicKey))
  } catch {
    throw new Error(`Not a BLS public key: ${publicKey}`)
  }
  return publicKey.toLowerCase()
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
  const operator = bls.deriveOperatorAccount(seed, network)
  const ed25519Master = hmac(sha512, utf8ToBytes(ED25519_SEED_KEY), seed)
  const platformAccount = accountLevels(network, 'platformNode')
    .reduce(slip10Child, {privateKey: ed25519Master.slice(0, 32), chainCode: ed25519Master.slice(32)})

  return {
    collateralXpub: root.derive(masternodeAccountPath(network, 'collateral')).publicExtendedKey,
    votingXpub: root.derive(masternodeAccountPath(network, 'voting')).publicExtendedKey,
    ownerXpub: root.derive(masternodeAccountPath(network, 'owner')).publicExtendedKey,
    operatorPublicKey: operator.publicKey,
    operatorChainCode: operator.chainCode,
    platformNodeKeys: Array.from({length: MASTERNODE_PLATFORM_KEY_BATCH},
      (_, index) => ed25519.getPublicKey(slip10Child(platformAccount, index).privateKey)),
  }
}

// One provider key chain of the stored account keys. Collateral, owner and
// voting keys are listed by their P2PKH address, operator keys by their hex public key.
export function masternodeKeyDeriver(keys: MasternodeKeys, network: Network, chain: MasternodeKeyFilter): AddressDeriver {
  const accountPath = masternodeAccountPath(network, chain)
  const xpubs = {collateral: keys.collateralXpub, owner: keys.ownerXpub, voting: keys.votingXpub}
  const account = chain === 'operator' ? null : HDKey.fromExtendedKey(xpubs[chain], HD_VERSIONS[network])
  return {
    derive: index => ({
      index,
      address: account == null
        ? bytesToHex(bls.deriveOperatorPublicKey({publicKey: keys.operatorPublicKey, chainCode: keys.operatorChainCode}, index))
        : keyPair.p2pkhAddress(account.deriveChild(index).publicKey!, network),
      derivationPath: `${accountPath}/${index}`,
    }),
  }
}

// An imported provider key in the form the list is searched by: an owner or
// voting WIF becomes its address, an operator's hex secret its public key.
export function masternodePublicKey(role: MasternodeKeyChain, privateKey: string, network: Network): string {
  if (role === 'operator') return bytesToHex(bls.blsPublicKey(hexToBytes(privateKey)))
  const key = PrivateKey.fromWIF(privateKey)
  // A WIF re-encodes to itself only on the network it was made for.
  if (PrivateKey.fromBytes(key.bytes(), network, key.compressed).toWIF() !== privateKey) {
    throw new Error(`Not a ${network} private key`)
  }
  return key.getAddress()
}
