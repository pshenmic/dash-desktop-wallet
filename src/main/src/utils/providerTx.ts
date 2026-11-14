import {
  MAINNET_CORE_PORT,
  MAINNET_PLATFORM_HTTP_PORT,
  MAINNET_PLATFORM_P2P_PORT,
  MAX_OPERATOR_REWARD,
  NON_ROUTABLE_IPV4,
} from '../constants/chain'
import {MasternodePlatformFields, MasternodeRegistration, MasternodeServiceUpdate, MasternodeType} from '../types/Masternode'
import {Network} from '../types/Network'

const isPort = (port: number | null): port is number => port != null && Number.isInteger(port) && port >= 1 && port <= 65535
export const isHash = (value: string): boolean => /^[0-9a-fA-F]{64}$/.test(value)
const ipv4Number = (ip: string): number => ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0)

function isRoutable(ip: string): boolean {
  const value = ipv4Number(ip)
  return !NON_ROUTABLE_IPV4.some(([network, bits]) =>
    Math.floor(value / 2 ** (32 - bits)) === Math.floor(ipv4Number(network) / 2 ** (32 - bits)))
}

// Core's MnNetInfo::ValidateService: a routable IPv4 address (all a v2 ProTx may
// carry on mainnet), on the mainnet Core port on mainnet and off it elsewhere.
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
