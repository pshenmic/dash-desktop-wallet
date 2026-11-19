import { ExtraPayload, Input, Output, Script, Transaction, TransactionType } from 'dash-core-sdk'
import type {
  MasternodeRegistrationPreviewDto,
  Network,
  PreviewEntry,
} from '@renderer/api/types'
import { DASH_UNIT } from '@renderer/constants/balance'
import { REGISTER_WIZARD_COPY } from '@renderer/constants/masternodeRegistration'
import { PROREG_DUST_THRESHOLD_DUFFS, PROREG_SEQUENCE_FINAL } from '@renderer/constants/masternodes'
import type { DropdownFieldOption } from '@renderer/types/DropdownField'
import type { CustomFeeProRegPreviewResult, FeeSelectableUtxo } from '@renderer/types/MasternodeRegistrationWizard'
import { isValidDashChangeAddress } from './address'
import { davToDash } from './balance'

const DUMMY_SIG_SCRIPT_ZEROS = 288
const DUMMY_TXID_HEX = '0'.repeat(64)

function isEligibleFeeUtxo(utxo: FeeSelectableUtxo, collateral: { txid: string; vout: number } | null): boolean {
  if (utxo.height <= 0 || utxo.isLocked || utxo.collateral === true) return false
  if (collateral != null && utxo.txid === collateral.txid && utxo.vout === collateral.vout) return false
  return true
}

export function coreFeePerByteForMultiplier(multiplier: number): number {
  const target = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
  let rate = 1
  let next = 1
  while (rate < target) {
    const sum = rate + next
    rate = next
    next = sum
  }
  return rate
}

export function proRegFeeDuffsForInputs(
  multiplier: number,
  inputsCount: number,
  payloadSignedBytes: number,
): bigint {
  const feePerByte = coreFeePerByteForMultiplier(multiplier)
  const dummyScript = new Script(`OP_PUSHDATA1 ${'0'.repeat(DUMMY_SIG_SCRIPT_ZEROS)}`)
  const dummyTx = new Transaction(
    Array.from({ length: inputsCount }, () => new Input(DUMMY_TXID_HEX, 1, dummyScript, 0)),
    [new Output(1n, dummyScript)],
    0,
    0,
  )
  return BigInt((dummyTx.signedSize() + payloadSignedBytes) * feePerByte)
}

export function eligibleCustomFeeUtxos(
  utxos: FeeSelectableUtxo[],
  feeAddress: string,
  collateral: { txid: string; vout: number } | null,
): FeeSelectableUtxo[] {
  const target = feeAddress.trim()
  if (target === '') return []
  return utxos
    .filter(utxo => utxo.address === target && isEligibleFeeUtxo(utxo, collateral))
    .sort((a, b) => (a.satoshis < b.satoshis ? 1 : a.satoshis > b.satoshis ? -1 : 0))
}

export function fundedFeeAddressOptions(
  addressOptions: DropdownFieldOption[],
  utxos: FeeSelectableUtxo[],
  collateral: { txid: string; vout: number } | null,
): DropdownFieldOption[] {
  const spendableByAddress = new Map<string, bigint>()
  for (const utxo of utxos) {
    if (!isEligibleFeeUtxo(utxo, collateral)) continue
    spendableByAddress.set(utxo.address, (spendableByAddress.get(utxo.address) ?? 0n) + utxo.satoshis)
  }

  return addressOptions.flatMap(option => {
    const spendable = spendableByAddress.get(option.value)
    if (spendable == null || spendable <= 0n) return []
    return [{
      ...option,
      metadata: [...(option.metadata ?? []), `${davToDash(spendable)} ${DASH_UNIT}`],
    }]
  })
}

export function buildCustomFeeProRegPreview(params: {
  basePreview: MasternodeRegistrationPreviewDto
  feeAddress: string
  utxos: FeeSelectableUtxo[]
  collateral: { txid: string; vout: number }
  coreFeeMultiplier: number
  network: Network | null
}): CustomFeeProRegPreviewResult {
  const trimmedAddress = params.feeAddress.trim()
  if (trimmedAddress === '' || !isValidDashChangeAddress(trimmedAddress, params.network ?? undefined)) {
    return { preview: null, error: REGISTER_WIZARD_COPY.customFeesInvalidAddress }
  }

  const candidates = eligibleCustomFeeUtxos(params.utxos, trimmedAddress, params.collateral)
  if (candidates.length === 0) {
    return { preview: null, error: REGISTER_WIZARD_COPY.customFeesNoEligibleCoins }
  }

  const parsed = Transaction.fromHex(params.basePreview.unsignedHex)
  if (!(parsed.extraPayload instanceof ExtraPayload.ProRegTX)) {
    return { preview: null, error: REGISTER_WIZARD_COPY.previewErrorTitle }
  }
  const payload = parsed.extraPayload
  payload.payloadSig = ''
  const payloadBytes = payload.signedSize()

  const selected: FeeSelectableUtxo[] = []
  let inputTotal = 0n
  let quotedFee = 0n
  for (const coin of candidates) {
    selected.push(coin)
    inputTotal += coin.satoshis
    quotedFee = proRegFeeDuffsForInputs(params.coreFeeMultiplier, selected.length, payloadBytes)
    if (inputTotal >= quotedFee) break
  }

  if (selected.length === 0 || inputTotal < quotedFee) {
    return { preview: null, error: REGISTER_WIZARD_COPY.customFeesInsufficient }
  }

  const tx = new Transaction(
    undefined,
    undefined,
    undefined,
    3,
    TransactionType.TRANSACTION_PROVIDER_REGISTER,
    payload,
  )
  for (const coin of selected) {
    tx.addInput(
      new Input(coin.txid, coin.vout, Output.createP2PKH(0n, coin.address).script, PROREG_SEQUENCE_FINAL),
    )
  }

  const change = inputTotal - quotedFee
  const outputs: PreviewEntry[] = []
  if (change >= PROREG_DUST_THRESHOLD_DUFFS) {
    tx.addOutput(Output.createP2PKH(change, trimmedAddress))
    outputs.push({
      role: 'change',
      address: trimmedAddress,
      amount: change,
      unit: 'duffs',
      reference: null,
    })
  }

  payload.inputsHash = tx.providerInputsHash()
  const feeDuffs = change >= PROREG_DUST_THRESHOLD_DUFFS ? quotedFee : inputTotal
  const inputs: PreviewEntry[] = selected.map(coin => ({
    role: 'feeInput',
    address: coin.address,
    amount: coin.satoshis,
    unit: 'duffs',
    reference: `${coin.txid}:${coin.vout}`,
  }))

  return {
    preview: {
      ...params.basePreview,
      inputs,
      outputs,
      feeDuffs,
      unsignedHex: tx.hex(),
    },
    error: null,
  }
}
