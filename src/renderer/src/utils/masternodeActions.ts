import type {
  ListedUtxo,
  MasternodeRegistrarUpdateDto,
  MasternodeRegistrationDto,
  MasternodeServiceUpdateDto,
  Network,
  SelectableUtxo,
} from '@renderer/api/types'
import {
  EVO_MASTERNODE_TYPE,
  MAINNET_CORE_PORT,
  MAINNET_PLATFORM_HTTP_PORT,
  MAINNET_PLATFORM_P2P_PORT,
  MASTERNODE_COLLATERAL_DUFFS,
  MAX_OPERATOR_REWARD_BPS,
} from '@renderer/constants/masternodes'
import { PayoutChoiceKind, RegistrarKeyChoiceKind } from '@renderer/enums/Masternodes'
import type {
  RegisterMasternodeFormInput,
  UpdateRegistrarFormInput,
  UpdateServiceFormInput,
} from '@renderer/types/MasternodeNodes'

const NODE_ID_PATTERN = /^[0-9a-fA-F]{40}$/
const BLS_PUBKEY_PATTERN = /^[0-9a-fA-F]{96}$/
const IPV4_PORT_PATTERN = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/

function isCollateralFlagged(utxo: SelectableUtxo): boolean {
  return 'collateral' in utxo && (utxo as ListedUtxo).collateral
}

export function eligibleCollateralUtxos(utxos: SelectableUtxo[], type: 'Regular' | 'Evo'): SelectableUtxo[] {
  const required = MASTERNODE_COLLATERAL_DUFFS[type]
  return utxos.filter(utxo => utxo.height > 0 && utxo.satoshis === required && !isCollateralFlagged(utxo))
}

export function parseOutpoint(outpoint: string): { txid: string; vout: number } | null {
  const parts = outpoint.trim().split(':')
  if (parts.length !== 2) return null
  const [txid, voutText] = parts
  const vout = Number(voutText)
  if (!/^[0-9a-fA-F]{64}$/.test(txid) || !Number.isInteger(vout) || vout < 0) return null
  return { txid, vout }
}

export function parseOperatorRewardBps(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return 0
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null
  const bps = Math.round(Number(trimmed) * 100)
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_OPERATOR_REWARD_BPS) return null
  return bps
}

export function validateServiceEndpoint(serviceAddress: string, network: Network | null): { port: number; error: string | null } {
  const match = IPV4_PORT_PATTERN.exec(serviceAddress.trim())
  if (match == null) return { port: 0, error: 'Enter an IPv4 address and port (e.g. 203.0.113.10:9999)' }
  const octets = match[1].split('.').map(Number)
  const port = Number(match[2])
  if (octets.some(octet => octet > 255) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { port: 0, error: 'Enter a valid IPv4 address and port (1–65535)' }
  }
  if (network === 'mainnet' && port !== MAINNET_CORE_PORT) {
    return { port, error: `A mainnet masternode serves on port ${MAINNET_CORE_PORT}` }
  }
  if (network === 'testnet' && port === MAINNET_CORE_PORT) {
    return { port, error: `Port ${MAINNET_CORE_PORT} is mainnet’s; use a testnet port` }
  }
  return { port, error: null }
}

function validateEvoPlatformFields(
  platformNodeId: string,
  platformP2PPortText: string,
  platformHttpPortText: string,
  corePort: number | null,
  network: Network | null,
): { nodeId: string; p2pPort: number; httpPort: number; error: string | null } {
  const nodeId = platformNodeId.trim()
  if (!NODE_ID_PATTERN.test(nodeId) || /^0+$/.test(nodeId)) {
    return { nodeId: '', p2pPort: 0, httpPort: 0, error: 'Platform Node ID must be 40 hex characters (not all zeros)' }
  }
  const p2pPort = Number(platformP2PPortText.trim())
  const httpPort = Number(platformHttpPortText.trim())
  if (!Number.isInteger(p2pPort) || p2pPort < 1 || p2pPort > 65535 || !Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) {
    return { nodeId, p2pPort: 0, httpPort: 0, error: 'Platform P2P and HTTP ports must be valid port numbers (1–65535)' }
  }
  if (network === 'mainnet' && (p2pPort !== MAINNET_PLATFORM_P2P_PORT || httpPort !== MAINNET_PLATFORM_HTTP_PORT)) {
    return {
      nodeId,
      p2pPort,
      httpPort,
      error: `Mainnet Evonodes use platform ports ${MAINNET_PLATFORM_P2P_PORT} (P2P) and ${MAINNET_PLATFORM_HTTP_PORT} (HTTP)`,
    }
  }
  if (p2pPort === MAINNET_CORE_PORT || httpPort === MAINNET_CORE_PORT) {
    return { nodeId, p2pPort, httpPort, error: `Port ${MAINNET_CORE_PORT} is the Core port and cannot be a platform port` }
  }
  if (p2pPort === httpPort || (corePort != null && (p2pPort === corePort || httpPort === corePort))) {
    return { nodeId, p2pPort, httpPort, error: 'Platform P2P, Platform HTTP and Core ports must all differ' }
  }
  return { nodeId, p2pPort, httpPort, error: null }
}

export function buildMasternodeRegistration(form: RegisterMasternodeFormInput): {
  dto: MasternodeRegistrationDto | null
  error: string | null
} {
  const collateral = parseOutpoint(form.collateralOutpoint)
  if (collateral == null) return { dto: null, error: 'Select a collateral UTXO' }

  const payoutAddress = form.payoutAddress.trim()
  if (payoutAddress === '') return { dto: null, error: 'Enter a payout address' }

  const operatorReward = parseOperatorRewardBps(form.operatorRewardPercent)
  if (operatorReward == null) return { dto: null, error: 'Operator reward must be between 0 and 100%' }

  const rawService = form.serviceAddress.trim()
  let corePort: number | null = null
  if (rawService !== '') {
    const endpoint = validateServiceEndpoint(rawService, form.network)
    if (endpoint.error != null) return { dto: null, error: endpoint.error }
    corePort = endpoint.port
  }

  if (form.type === 'Regular') {
    return {
      dto: {
        type: 'Regular',
        collateral,
        serviceAddress: rawService === '' ? null : rawService,
        payoutAddress,
        operatorReward,
        platformNodeId: null,
        platformP2PPort: null,
        platformHttpPort: null,
      },
      error: null,
    }
  }

  const evo = validateEvoPlatformFields(form.platformNodeId, form.platformP2PPort, form.platformHttpPort, corePort, form.network)
  if (evo.error != null) return { dto: null, error: evo.error }

  return {
    dto: {
      type: 'Evo',
      collateral,
      serviceAddress: rawService === '' ? null : rawService,
      payoutAddress,
      operatorReward,
      platformNodeId: evo.nodeId,
      platformP2PPort: evo.p2pPort,
      platformHttpPort: evo.httpPort,
    },
    error: null,
  }
}

export function buildRegistrarUpdate(form: UpdateRegistrarFormInput): {
  dto: MasternodeRegistrarUpdateDto | null
  error: string | null
} {
  const payout = form.payoutChoice === PayoutChoiceKind.Keep ? null : form.payoutAddress.trim()
  if (form.payoutChoice === PayoutChoiceKind.Keep && form.currentPayeeAddress == null) {
    return { dto: null, error: 'Current payout address is not indexed yet; enter a payout address' }
  }
  if (form.payoutChoice === PayoutChoiceKind.Custom && (payout == null || payout === '')) {
    return { dto: null, error: 'Enter a new payout address' }
  }

  let operator: MasternodeRegistrarUpdateDto['operator']
  if (form.operatorChoice === RegistrarKeyChoiceKind.Keep) {
    operator = { kind: 'keep' }
  } else if (form.operatorChoice === RegistrarKeyChoiceKind.Wallet) {
    operator = { kind: 'wallet' }
  } else {
    const publicKey = form.operatorPublicKey.trim().toLowerCase()
    if (!BLS_PUBKEY_PATTERN.test(publicKey) || /^0+$/.test(publicKey)) {
      return { dto: null, error: 'Operator public key must be 96 hex characters' }
    }
    operator = { kind: 'external', publicKey }
  }

  let voting: MasternodeRegistrarUpdateDto['voting']
  if (form.votingChoice === RegistrarKeyChoiceKind.Keep) {
    voting = { kind: 'keep' }
  } else if (form.votingChoice === RegistrarKeyChoiceKind.Wallet) {
    voting = { kind: 'wallet' }
  } else {
    const address = form.votingAddress.trim()
    if (address === '') return { dto: null, error: 'Enter an external P2PKH voting address' }
    voting = { kind: 'external', address }
  }

  return {
    dto: {
      operator,
      voting,
      payoutAddress: payout,
    },
    error: null,
  }
}

export function buildServiceUpdate(form: UpdateServiceFormInput): {
  dto: MasternodeServiceUpdateDto | null
  error: string | null
} {
  const serviceAddress = form.serviceAddress.trim()
  const endpoint = validateServiceEndpoint(serviceAddress, form.network)
  if (endpoint.error != null) return { dto: null, error: endpoint.error }

  const operatorPayout = form.operatorPayoutAddress.trim()
  if (form.type !== EVO_MASTERNODE_TYPE) {
    return {
      dto: {
        serviceAddress,
        operatorPayoutAddress: operatorPayout === '' ? null : operatorPayout,
        platformNodeId: null,
        platformP2PPort: null,
        platformHttpPort: null,
      },
      error: null,
    }
  }

  const evo = validateEvoPlatformFields(form.platformNodeId, form.platformP2PPort, form.platformHttpPort, endpoint.port, form.network)
  if (evo.error != null) return { dto: null, error: evo.error }

  return {
    dto: {
      serviceAddress,
      operatorPayoutAddress: operatorPayout === '' ? null : operatorPayout,
      platformNodeId: evo.nodeId,
      platformP2PPort: evo.p2pPort,
      platformHttpPort: evo.httpPort,
    },
    error: null,
  }
}
