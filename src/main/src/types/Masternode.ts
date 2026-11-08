export type MasternodeKeyRole = 'voting' | 'owner' | 'operator' | 'platformNode'
// The roles a masternode list can be searched by, each walked as a key chain.
export type MasternodeKeyChain = 'owner' | 'voting' | 'operator'
export type MasternodeKeyFilter = MasternodeKeyChain | 'collateral'
export type MasternodeType = 'Regular' | 'Evo'

// What the caller decides about a registration; the owner, voting and operator
// keys are the wallet's own. operatorReward is in hundredths of a percent, as
// ProRegTx carries it. A null serviceAddress registers without one, to be set
// later by the operator's ProUpServTx. The platform fields are an Evo's alone;
// platformNodeId is the Tenderdash node id, whose key the node generated.
export interface MasternodeRegistration {
  type: MasternodeType
  collateral: {txid: string; vout: number}
  serviceAddress: string | null
  payoutAddress: string
  operatorReward: number
  platformNodeId: string | null
  platformP2PPort: number | null
  platformHttpPort: number | null
}

// The wallet's provider keys at the indexes a registration takes, in the form
// ProRegTx carries them.
export interface ProviderKeyIds {
  ownerKeyId: string
  votingKeyId: string
  operatorPublicKey: string
}

export interface MasternodeRegistrationResult {
  proTxHash: string
  fee: bigint
  peersAcked: number
}

// One entry of the network's masternode list. Times are unix seconds, 0 = never.
// Null is a field the source cannot give: the p2p list carries no PoSe score or
// payments, and the ProRegTx fields stay null until the registration is indexed.
export interface NetworkMasternode {
  proTxHash: string
  type: string
  status: string
  posePenaltyScore: number | null
  collateralTxid: string | null
  collateralVout: number | null
  collateralAddress: string | null
  serviceAddress: string | null
  payeeAddress: string | null
  ownerAddress: string | null
  votingAddress: string
  operatorPublicKey: string
  platformNodeId: string | null
  platformP2PPort: number | null
  platformHttpPort: number | null
  lastPaidBlock: number | null
  lastPaidTime: number | null
  // Known only to the p2p index, which read the ProRegTx at this height.
  registeredHeight: number | null
}

// A masternode this wallet holds a key or the collateral of. A null index is a
// key the seed does not derive; importedRoles are the ones held by an imported key.
export interface Masternode extends NetworkMasternode {
  ownerKeyIndex: number | null
  votingKeyIndex: number | null
  operatorKeyIndex: number | null
  importedRoles: MasternodeKeyChain[]
}

// publicKey is what the list carries for the role: the address for owner and
// voting, the hex public key for operator.
export interface ImportedMasternodeKey {
  role: MasternodeKeyChain
  publicKey: string
}

// What outlives the list: the coin a send must not spend, and whether the p2p
// scan already covers the node's payout changes from its registration.
export interface MasternodeCollateral {
  proTxHash: string
  txid: string
  vout: number
  followed: boolean
}

// What a wallet persists to derive its provider keys without the seed. The
// operator node is BLS, which has no xpub encoding; its public key is the
// standard compressed G1 point. Platform node keys are ed25519, indexed 0'…
export interface MasternodeKeys {
  votingXpub: string
  ownerXpub: string
  operatorPublicKey: Uint8Array
  operatorChainCode: Uint8Array
  platformNodeKeys: Uint8Array[]
}

export interface ExtendedSecretKey {
  privateKey: Uint8Array
  chainCode: Uint8Array
}
