import {bls12_381} from '@noble/curves/bls12-381.js'
import {secp256k1} from '@noble/curves/secp256k1.js'
import {bytesToHex, concatBytes, utf8ToBytes} from '@noble/hashes/utils.js'
import {OutPoint} from 'dash-core-sdk/src/types/OutPoint.js'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {ProUpRevTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRevTx.js'
import {ProUpServTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpServTx.js'
import {COMPACT_SIGNATURE_SIZE} from 'dash-core-sdk/src/constants.js'
import {doubleSHA256, encodeCompactSize, getCompactVariableSize} from 'dash-core-sdk/src/utils.js'
import {
  BLS_SIGNATURE_SIZE,
  MAINNET_CORE_PORT,
  MAINNET_PLATFORM_HTTP_PORT,
  MAINNET_PLATFORM_P2P_PORT,
  MAX_OPERATOR_REWARD,
  MESSAGE_MAGIC,
  NON_ROUTABLE_IPV4,
} from '../constants/chain'
import {ProviderPayload} from '../types/CoreTransaction'
import {MasternodePlatformFields, MasternodeRegistration, MasternodeServiceUpdate, MasternodeType} from '../types/Masternode'
import {Network} from '../types/Network'

// uint256 hex is printed byte-reversed, as Core's ToString() does.
function uint256Hex(hash: Uint8Array): string {
  return bytesToHex(hash.toReversed())
}

export function providerInputsHash(inputs: Array<{txId: string; vOut: number}>): string {
  return uint256Hex(doubleSHA256(concatBytes(...inputs.map(({txId, vOut}) => new OutPoint(txId, vOut).bytes()))))
}

// The operator signs with BLS, a fixed 96 bytes; the other keys sign compact
// secp256k1, a length-prefixed 65.
function isOperatorSigned(payload: ProviderPayload): payload is ProUpServTx | ProUpRevTx {
  return payload instanceof ProUpServTx || payload instanceof ProUpRevTx
}

// A ProUpRevTx serializes a missing signature as 96 zero bytes, so the signed
// shape comes from a placeholder rather than from whatever payloadSig holds.
function signedBytes(payload: ProviderPayload): {bytes: Uint8Array; signature: number} {
  const length = isOperatorSigned(payload) ? BLS_SIGNATURE_SIZE : COMPACT_SIGNATURE_SIZE
  const placeholder = Object.assign(Object.create(Object.getPrototypeOf(payload)), payload, {payloadSig: '00'.repeat(length)})
  return {bytes: placeholder.bytes(), signature: isOperatorSigned(payload) ? length : getCompactVariableSize(length) + length}
}

// Core hashes the payload with SER_GETHASH, which drops the signature and any
// length prefix it carries.
export function payloadDigest(payload: ProviderPayload): Uint8Array {
  const {bytes, signature} = signedBytes(payload)
  return doubleSHA256(bytes.slice(0, bytes.length - signature))
}

// CProRegTx::MakeSignString, which the collateral key signs as a message.
export function proRegSignString(payload: ProRegTX, network: Network): string {
  return [
    payload.getPayoutAddress(network),
    payload.operatorReward,
    payload.getOwnerAddress(network),
    payload.getVotingAddress(network),
    uint256Hex(payloadDigest(payload)),
  ].join('|')
}

export function signedMessageHash(message: string): Uint8Array {
  const varString = (text: string): Uint8Array => {
    const bytes = utf8ToBytes(text)
    return concatBytes(encodeCompactSize(bytes.length), bytes)
  }
  return doubleSHA256(concatBytes(varString(MESSAGE_MAGIC), varString(message)))
}

// What a payload adds to the transaction once signed, its own length prefix included.
export function providerPayloadBytes(payload: ProviderPayload): number {
  const {length} = signedBytes(payload).bytes
  return length + getCompactVariableSize(length)
}

const isPort = (port: number | null): port is number => port != null && Number.isInteger(port) && port >= 1 && port <= 65535
const isHash = (value: string): boolean => /^[0-9a-fA-F]{64}$/.test(value)
const ipv4Number = (ip: string): number => ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0)

function isRoutable(ip: string): boolean {
  const value = ipv4Number(ip)
  return !NON_ROUTABLE_IPV4.some(([network, bits]) =>
    Math.floor(value / 2 ** (32 - bits)) === Math.floor(ipv4Number(network) / 2 ** (32 - bits)))
}

// Core's MnNetInfo::ValidateService: a routable IPv4 address, on the mainnet
// Core port on mainnet and on any other port elsewhere. IPv4 only: a v2 ProTx
// on mainnet is refused any other address.
export function serviceAddressParts(serviceAddress: string, network: Network): {ip: string; port: number} {
  const match = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.exec(serviceAddress.trim())
  if (match == null || match[1].split('.').some(octet => Number(octet) > 255) || !isPort(Number(match[2]))) {
    throw new Error(`Not an IPv4 address and port: ${serviceAddress}`)
  }
  const [, ip, portText] = match
  const port = Number(portText)
  if (!isRoutable(ip)) throw new Error(`${ip} is not a public address: a masternode must be reachable from the internet`)
  if ((network === 'mainnet') !== (port === MAINNET_CORE_PORT)) {
    throw new Error(network === 'mainnet'
      ? `A mainnet masternode serves on port ${MAINNET_CORE_PORT}`
      : `Port ${MAINNET_CORE_PORT} is mainnet's; a ${network} masternode uses another port`)
  }
  return {ip, port}
}

export function requireProTxHash(proTxHash: string): void {
  if (!isHash(proTxHash)) throw new Error('Not a proTxHash: 64 hex characters')
}

export function requireRegistrationFields(registration: MasternodeRegistration, network: Network): void {
  const {collateral, operatorReward, serviceAddress} = registration
  if (!isHash(collateral.txid) || !Number.isInteger(collateral.vout) || collateral.vout < 0) {
    throw new Error('The collateral must be a txid and an output index')
  }
  if (!Number.isInteger(operatorReward) || operatorReward < 0 || operatorReward > MAX_OPERATOR_REWARD) {
    throw new Error(`Operator reward must be a whole number from 0 to ${MAX_OPERATOR_REWARD}`)
  }
  const corePort = serviceAddress == null ? null : serviceAddressParts(serviceAddress, network).port
  requirePlatformFields(registration.type, registration, network, corePort)
}

export function requireServiceUpdate(type: MasternodeType, update: MasternodeServiceUpdate, network: Network): void {
  requirePlatformFields(type, update, network, serviceAddressParts(update.serviceAddress, network).port)
}

// Core's CheckProviderNetworkFields for the platform half of a service.
function requirePlatformFields(type: MasternodeType, fields: MasternodePlatformFields, network: Network, corePort: number | null): void {
  const {platformNodeId, platformP2PPort, platformHttpPort} = fields
  if (type === 'Regular') {
    if ([platformNodeId, platformP2PPort, platformHttpPort].some(field => field != null)) {
      throw new Error('Platform fields are for Evo masternodes only')
    }
    return
  }
  if (platformNodeId == null || !/^[0-9a-fA-F]{40}$/.test(platformNodeId) || /^0+$/.test(platformNodeId)) {
    throw new Error('An Evo masternode needs its platform node id, 40 hex characters, not all zero')
  }
  if (!isPort(platformP2PPort) || !isPort(platformHttpPort)) {
    throw new Error('An Evo masternode needs its platform P2P and HTTP ports')
  }
  if (network === 'mainnet' && (platformP2PPort !== MAINNET_PLATFORM_P2P_PORT || platformHttpPort !== MAINNET_PLATFORM_HTTP_PORT)) {
    throw new Error(`A mainnet Evo masternode uses platform ports ${MAINNET_PLATFORM_P2P_PORT} (P2P) and ${MAINNET_PLATFORM_HTTP_PORT} (HTTP)`)
  }
  if (platformP2PPort === MAINNET_CORE_PORT || platformHttpPort === MAINNET_CORE_PORT) {
    throw new Error(`Port ${MAINNET_CORE_PORT} is the Core port and cannot be a platform port`)
  }
  if (platformP2PPort === platformHttpPort || platformP2PPort === corePort || platformHttpPort === corePort) {
    throw new Error('The platform P2P, platform HTTP and Core ports must all differ')
  }
}

// Core's compact signature leads with 27 + recovery id, plus 4 for a compressed
// key; noble's recovered format leads with the bare recovery id.
export function signHash(hash: Uint8Array, privateKey: Uint8Array): Uint8Array {
  const signature = secp256k1.sign(hash, privateKey, {prehash: false, lowS: true, format: 'recovered'})
  return concatBytes(Uint8Array.of(31 + signature[0]), signature.slice(1))
}

export function signMessage(message: string, privateKey: Uint8Array): Uint8Array {
  return signHash(signedMessageHash(message), privateKey)
}

// Dash's basic scheme is the IETF one noble defaults to: G1 keys, G2 signatures.
export function signBls(hash: Uint8Array, secretKey: Uint8Array): Uint8Array {
  const {longSignatures} = bls12_381
  return longSignatures.Signature.toBytes(longSignatures.sign(longSignatures.hash(hash), secretKey))
}
