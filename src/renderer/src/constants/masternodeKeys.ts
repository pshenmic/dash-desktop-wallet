import type { Network } from '@renderer/api/types'
import { MASTERNODE_KEY_ROLE_LABELS } from '@renderer/constants/masternodeNodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export const WIF_NETWORK_BY_BYTE: Readonly<Record<number, Network>> = {
  204: 'mainnet',
  239: 'testnet',
}

export const P2PKH_VERSION_BYTES: Readonly<Record<Network, number>> = {
  mainnet: 76,
  testnet: 140,
}

export const BLS_SECRET_KEY_HEX_PATTERN = /^[0-9a-fA-F]{64}$/
export const DASH_CONF_BLS_PREFIX_PATTERN = /^masternodeblsprivkey\s*=\s*/i
export const KEY_LINE_PREFIX_PATTERN = /^(?:masternodeblsprivkey|operator|owner|voting|privkey|key)\s*[:=]\s*/i
export const KEY_TOKEN_SPLIT_PATTERN = /[\r\n,;]+|\s+/
export const KEY_WRAPPER_QUOTES_PATTERN = /^['"]+|['"]+$/g
export const WIF_UNCOMPRESSED_LEN = 33
export const WIF_COMPRESSED_LEN = 34
export const WIF_COMPRESSED_FLAG = 0x01
export const BLS_LEGACY_LOW_MASK = 0x1f
export const BLS_LEGACY_SIGN_BIT = 0x20
export const BLS_LEGACY_SIGN_SHIFT = 2

export const WIF_CANDIDATE_ROLES: readonly ('owner' | 'voting')[] = ['owner', 'voting']

export const WIF_ROLE_OPTIONS: SegmentOption<'owner' | 'voting'>[] = WIF_CANDIDATE_ROLES.map(role => ({
  value: role,
  label: MASTERNODE_KEY_ROLE_LABELS[role],
}))
