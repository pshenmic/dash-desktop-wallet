import {MasternodeKeyFilter} from '../types/Masternode'

export const DASHSCAN_BASE_URLS: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'https://dashscan.pshenmic.dev',
  testnet: 'https://testnet.dashscan.pshenmic.dev'
}

export const DASHSCAN_MASTERNODE_FILTER: Record<MasternodeKeyFilter, string> = {
  owner: 'owner_address',
  voting: 'voting_address',
  operator: 'pub_key_operator',
  collateral: 'collateral_address',
}

// The batch endpoints, masternode filters included, reject more than 100 values per call.
export const DASHSCAN_ADDRESS_CHUNK = 100

export const XPUB_PAGE_LIMIT = 100

// Dashscan names the DIP-2 type as its own enum member; the SDK names the
// payload class instead, and the transaction DTO uses the SDK's name in both
// modes. CLASSIC carries no payload and is deliberately absent.
export const DASHSCAN_EXTRA_PAYLOAD_TYPE: Record<string, string> = {
  PROVIDER_REGISTRATION: 'ProRegTx',
  PROVIDER_UPDATE_SERVICE: 'ProUpServTx',
  PROVIDER_UPDATE_REGISTRAR: 'ProUpRegTx',
  PROVIDER_UPDATE_REVOCATION: 'ProUpRevTx',
  COINBASE: 'CbTx',
  QUORUM_COMMITMENT: 'QcTx',
  MASTERNODE_HARD_FORK_SIGNAL: 'MnHfTx',
  ASSET_LOCK: 'AssetLockTx',
  ASSET_UNLOCK: 'AssetUnlockTx',
  PROVIDER_DISSOLVE: 'ProDisTx',
  PROVIDER_UPDATE_SHARE: 'ProUpShareTx',
  PROVIDER_UPDATE_SHARED_REGISTRAR: 'ProUpSharedRegTx',
}

// A cursor that does not advance would otherwise spin the page walk forever.
export const XPUB_MAX_PAGES = 200

// Chromium's own timeout runs into the tens of seconds — long enough that a
// stalled read reads as a hung wallet.
export const DASHSCAN_REQUEST_TIMEOUT_MS = 30_000
export const DASHSCAN_STATUS_INTERVAL_MS = 15_000
export const DASHSCAN_RETRY_DELAYS_MS = [300, 1_200]
