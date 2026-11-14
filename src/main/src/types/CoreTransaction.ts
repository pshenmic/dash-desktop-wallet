import {Script} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {ProUpRegTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRegTx.js'
import {ProUpRevTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRevTx.js'
import {ProUpServTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpServTx.js'
import {Network} from './Network'

export type RecipientType = 'p2pkh' | 'p2sh'

export interface TransferInput {
  txId: string
  vOut: number
  script: Script
  derivationPath: string
  address: string
}

// One output of a send, as the caller named it. Unlike a platform transition
// nothing is keyed by address, so the same address twice is two payments.
export interface CoreRecipient {
  address: string
  amountDuffs: bigint
}

// The same output once its script kind is known, which only the network the
// send runs on can decide.
export interface TransferOutput extends CoreRecipient {
  recipientType: RecipientType
}

export interface TransferInputSelection {
  transferInputs: TransferInput[]
  inputTotal: bigint
  changeAddress: string
  feeDuffs: bigint
}

// Everything a transaction is made of. Signing needs the seed and the network
// on top of it, and nothing else does — which is what lets the same build
// answer a preview and a send.
export interface BuildTransferParams {
  inputs: TransferInput[]
  outputs: TransferOutput[]
  changeAddress: string
  inputTotal: bigint
  feeDuffs: bigint
}

export interface BuildSignedTransferParams extends BuildTransferParams {
  seed: Uint8Array
  network: Network
}

export interface BuildAssetLockParams {
  inputs: TransferInput[]
  amountDuffs: bigint
  creditAddress: string
  changeAddress: string
  inputTotal: bigint
  feeDuffs: bigint
}

export interface BuildSignedAssetLockParams extends BuildAssetLockParams {
  seed: Uint8Array
  network: Network
}

export type ProviderPayload = ProRegTX | ProUpRegTx | ProUpServTx | ProUpRevTx

// The key a payload is signed with: a wallet address's — the collateral's for a
// ProRegTx, the owner's for a ProUpRegTx — or the operator BLS key at an index.
export type ProviderTxSigner =
  | {kind: 'address'; derivationPath: string; address: string}
  | {kind: 'operator'; index: number}

// payload is completed here: its inputs hash and signature both depend on the
// inputs chosen.
export interface BuildSignedProviderTxParams {
  payload: ProviderPayload
  signer: ProviderTxSigner
  inputs: TransferInput[]
  changeAddress: string
  inputTotal: bigint
  feeDuffs: bigint
  seed: Uint8Array
  network: Network
}
