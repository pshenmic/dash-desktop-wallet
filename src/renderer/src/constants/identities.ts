export const IDENTITIES_ROUTES = {
  root: '/identities',
  register: '/identities/register',
  identity: '/identities/:identifier',
  addKeys: '/identities/:identifier/keys/new',
} as const

export const IDENTITY_ROUTE_PARAM = ':identifier'

export const IDENTITIES_SEARCH_COPY = {
  label: 'Search identities',
  placeholder: 'Search name or identity ID',
  noMatch: 'No matching identities',
} as const

export const IDENTITY_ROW_COPY = {
  open: 'Open',
  menuTitle: 'Identity actions',
  manageKeys: 'Manage keys',
  copyId: 'Copy identity ID',
  explorer: 'Open in explorer',
} as const

export const IDENTITIES_TABS = {
  param: 'tab',
  sourceParam: 'source',
  masternodeSource: 'masternode',
  yourIdentities: 'your-identities',
  masternodeIdentities: 'masternode-identities',
  yourLabel: 'Your Identities',
  masternodeLabel: 'Masternode Identities',
} as const

export const MASTERNODE_IDENTITIES_COPY = {
  searchPlaceholder: 'Search name, identity ID, or ProTxHash',
  loadFailed: 'Failed to load masternode identities',
  emptyTitle: 'No masternode identities',
  emptyDescription: 'Identities derived from your wallet-owned or imported masternode owner and voting keys appear here once registered.',
  viewIdentity: 'View identity',
  proTxHashLabel: 'Linked masternode ProTxHash',
  roleLabels: {
    owner: 'Owner',
    voter: 'Voting',
  } as Record<'owner' | 'voter', string>,
} as const

export const IDENTITY_DETAIL_COPY = {
  title: 'Identity',
  balance: 'Balance',
  usernames: 'Usernames',
  votingUsernames: 'Usernames in vote',
  keys: 'Keys',
  active: 'active',
  explorer: 'Open in explorer',
  missing: 'This identity is no longer in this wallet',
  backToIdentities: 'Back to identities',
  loadFailed: 'Failed to load identities',
} as const

export const IDENTITY_DETAIL_SKELETON_ROWS = 4

export const IDENTITY_DETAIL_ROOT_CLASS = 'flex flex-col px-12 pb-12'

export const IDENTITY_TOKEN_ICON_CLASS = 'dash-text-primary'
