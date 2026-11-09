import {MasternodeKeyFilter} from '../types/Masternode'

export const DASHSCAN_BASE_URLS: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'https://dashscan.pshenmic.dev',
  // Local instance until the masternode key filters are deployed.
  testnet: 'http://localhost:3005'
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
// A cursor that does not advance would otherwise spin the page walk forever.
export const XPUB_MAX_PAGES = 200

// Chromium's own timeout runs into the tens of seconds — long enough that a
// stalled read reads as a hung wallet.
export const DASHSCAN_REQUEST_TIMEOUT_MS = 30_000
export const DASHSCAN_STATUS_INTERVAL_MS = 15_000
export const DASHSCAN_RETRY_DELAYS_MS = [300, 1_200]
