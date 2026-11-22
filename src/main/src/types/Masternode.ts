import type {Script, Transaction} from 'dash-core-sdk'
import type {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import type {WalletProvider} from '../providers/WalletProvider'
import type {ProviderPayload, ProviderTxSigner} from './CoreTransaction'
import type {GroupedAddresses} from './GroupedAddresses'
import type {Network} from './Network'
import type {PreviewEntry} from './TransactionPreview'
import type {UTXO} from './UTXO'

export type MasternodeKeyRole = 'collateral' | 'voting' | 'owner' | 'operator' | 'platformNode'
// The roles a masternode list can be searched by, each walked as a key chain.
export type MasternodeKeyChain = 'owner' | 'voting' | 'operator'
export type MasternodeKeyFilter = MasternodeKeyChain | 'collateral'
export type MasternodeType = 'Regular' | 'Evo'

// An Evo's alone, null on a Regular node. platformNodeId is the Tenderdash node
// id, whose key the node generated.
export interface MasternodePlatformFields {
  platformNodeId: string | null
  platformP2PPort: number | null
  platformHttpPort: number | null
}

// operatorReward is in hundredths of a percent, as ProRegTx carries it. A null
// serviceAddress registers without one, left to the operator's ProUpServTx.
// A null owner, voting or operator key takes the wallet's next unused key; owner
// and voting are P2PKH addresses, operator is a BLS basic public key.
export interface MasternodeRegistration extends MasternodePlatformFields {
  type: MasternodeType
  collateral: {txid: string; vout: number}
  serviceAddress: string | null
  payoutAddress: string
  operatorReward: number
  ownerAddress: string | null
  votingAddress: string | null
  operatorPublicKey: string | null
}

// A ProUpServTx restates the whole service, so every field is the new value.
// operatorPayoutAddress must stay null on a node registered with no operator reward.
export interface MasternodeServiceUpdate extends MasternodePlatformFields {
  serviceAddress: string
  operatorPayoutAddress: string | null
}

export type RevocationReason = 'notSpecified' | 'termination' | 'compromisedKeys' | 'changeOfKeys'

// The wallet's provider keys at the indexes a registration takes, in the form
// ProRegTx carries them.
export interface ProviderKeyIds {
  ownerKeyId: string
  votingKeyId: string
  operatorPublicKey: string
}

// wallet is the chain's lowest index no listed node carries. A new operator key
// PoSe-bans the node until that operator's ProUpServTx; a null payoutAddress keeps the payout.
export type OperatorKeyChoice = {kind: 'keep'} | {kind: 'wallet'} | {kind: 'external'; publicKey: string}
export type VotingKeyChoice = {kind: 'keep'} | {kind: 'wallet'} | {kind: 'external'; address: string}

export interface MasternodeRegistrarUpdate {
  operator: OperatorKeyChoice
  voting: VotingKeyChoice
  payoutAddress: string | null
}

// What a provider transaction is planned from, once the wallet is unlocked.
export interface ProviderTxContext {
  network: Network
  keys: MasternodeKeys
  owned: Masternode[]
  imported: ImportedMasternodeKey[]
  provider: WalletProvider
  grouped: GroupedAddresses
  utxos: UTXO[]
  collaterals: MasternodeCollateral[]
}

// spendable is what the fee may come from, before the stored collaterals are taken out.
export interface ProviderTxPlan {
  payload: ProviderPayload
  signer: ProviderTxSigner
  spendable: UTXO[]
}

// A registration plan plus the keys it resolved: null indexes are keys the
// caller supplied rather than ones the wallet derives.
export interface MasternodeRegistrationPlan extends ProviderTxPlan {
  payload: ProRegTX
  ownerAddress: string
  votingAddress: string
  operatorPublicKey: string
  ownerKeyIndex: number | null
  votingKeyIndex: number | null
  operatorKeyIndex: number | null
}

// The network's own list, which carries a node exactly while its collateral is
// unspent; askedAt is when the lock pool asked for it, 0 for one it did not ask for.
export interface ListedMasternodes {
  proTxHashes: Set<string>
  askedAt: number
  v24Active: boolean
}

export interface MasternodeUpdateResult {
  txid: string
  fee: bigint
  peersAcked: number
}

export interface MasternodeRegistrationResult {
  proTxHash: string
  fee: bigint
  peersAcked: number
}

// A registration read back from a ProRegTx: the payload always carries all three
// keys, unlike the caller's request where a null one means "the wallet's next".
export interface ParsedMasternodeRegistration extends MasternodeRegistration {
  ownerAddress: string
  votingAddress: string
  operatorPublicKey: string
}

export interface MasternodeRegistrationPreview extends ParsedMasternodeRegistration {
  ownerKeyIndex: number | null
  votingKeyIndex: number | null
  operatorKeyIndex: number | null
  inputs: PreviewEntry[]
  outputs: PreviewEntry[]
  feeDuffs: bigint
  unsignedHex: string
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
  isShared: boolean | null
  shares: MasternodeShare[] | null
}

// One participant's contribution to a shared masternode's collateral.
export interface MasternodeShare {
  ownerAddress: string
  amountDuffs: bigint
}

// A share with the wallet's marks: keyIndex is the owner-chain index holding it,
// null when the seed does not derive it; imported is an imported owner key, and
// canSign says its secret is stored, so it can consent and fund.
export interface OwnedMasternodeShare extends MasternodeShare {
  keyIndex: number | null
  imported: boolean
  canSign: boolean
}

// A masternode this wallet holds a key or the collateral of. A null index is a
// key the seed does not derive; importedRoles are the ones held by an imported key,
// importedSigningRoles the subset whose secret is stored.
export interface Masternode extends NetworkMasternode {
  ownerKeyIndex: number | null
  votingKeyIndex: number | null
  operatorKeyIndex: number | null
  importedRoles: MasternodeKeyChain[]
  importedSigningRoles: MasternodeKeyChain[]
  shares: OwnedMasternodeShare[] | null
}

// publicKey is what the list carries for the role: the address for owner and
// voting, the hex public key for operator. hasPrivateKey is true when the
// secret is stored, which is what lets a key sign.
export interface ImportedMasternodeKey {
  role: MasternodeKeyChain
  publicKey: string
  hasPrivateKey: boolean
}

// One row of a shared registration's share table, already resolved for display.
export interface SharedRegistrationShare {
  index: number
  amountDuffs: bigint
  ownerAddress: string
  refundAddress: string | null
  rewardAddress: string | null
}

// A funding input of the prepared registration that this wallet can sign.
export interface SharedRegistrationFundingInput {
  index: number
  address: string
  amountDuffs: bigint
}

// How to obtain the key for one funding input: a wallet derivation path, or an
// imported owner/voting key whose secret is stored.
export type SharedRegistrationFundingSource =
  | {kind: 'wallet'; index: number; address: string; amountDuffs: bigint; script: Script; derivationPath: string}
  | {kind: 'imported'; index: number; address: string; amountDuffs: bigint; script: Script; role: 'owner' | 'voting'; publicKey: string}

// One output of a prepared registration, so a participant sees where the coins
// go: the collateral output has no address and is flagged.
export interface SharedRegistrationOutput {
  address: string | null
  amountDuffs: bigint
  collateral: boolean
}

// What any shared registration step shows before signing.
export interface SharedRegistrationPreview {
  consentHash: string
  shares: SharedRegistrationShare[]
  signableShares: number[]
  outputs: SharedRegistrationOutput[]
  collateralDuffs: bigint
  warning: string | null
}

// The preview plus this wallet's funding side: the inputs it can sign and the
// ones it could not match to a coin or key it holds.
export interface SharedRegistrationFundingPreview extends SharedRegistrationPreview {
  fundingInputs: SharedRegistrationFundingInput[]
  fundingTotalDuffs: bigint
  unresolvedInputs: number
}

export interface SharedRegistrationOutpoint {
  txid: string
  vout: number
}

// One member's contribution as the coordinator knows it: their share terms, their
// change destination and the coins they will sign.
export interface SharedRegistrationMemberDraft {
  amountDuffs: bigint
  ownerAddress: string
  refundAddress: string
  rewardAddress: string | null
  changeAddress: string
  inputs: SharedRegistrationOutpoint[]
}

// What the coordinator supplies to build a registration. Every member pays its
// own share and fee share.
export interface SharedRegistrationDraft {
  members: SharedRegistrationMemberDraft[]
  serviceAddress: string | null
  operatorPublicKey: string
  votingAddress: string
  operatorReward: number
  earlyPeriodBlocks: number
  earlyPenaltyDuffs: bigint
  feeDuffs: bigint
}

// One share owner's consent, base64 compact signature as shared_combine expects.
export interface SharedRegistrationSignature {
  shareIndex: number
  signature: string
}

export interface SharedRegistrationConsentResult {
  preview: SharedRegistrationPreview
  signatures: SharedRegistrationSignature[]
}

export interface SharedRegistrationFundingResult {
  preview: SharedRegistrationFundingPreview
  signedHex: string
  signedInputs: number[]
}

// A shared registration read back before either side signs: its shares, the keys
// this wallet holds for them, and which of those keys have a stored secret.
export interface SharedRegistrationBase {
  tx: Transaction
  network: Network
  shares: SharedRegistrationShare[]
  keys: MasternodeKeys | null
  imported: ImportedMasternodeKey[]
  ownerIndexes: Map<string, number>
  importedOwners: Set<string>
  signableShares: number[]
}

// What outlives the list: the coin a send must not spend, and whether the p2p
// scan already covers the node's payout changes from its registration.
export interface MasternodeCollateral {
  proTxHash: string
  txid: string
  vout: number
  followed: boolean
}

export interface OwnedCollateral {
  proTxHash: string
  txid: string
  vout: number
  address: string | null
}

// What a wallet persists to derive its provider keys without the seed. The
// operator node is BLS, which has no xpub encoding; its public key is the
// standard compressed G1 point. Platform node keys are ed25519, indexed 0'…
export interface MasternodeKeys {
  collateralXpub: string
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
