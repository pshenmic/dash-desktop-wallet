import type { SelectableUtxo, WalletAddressDto } from '@renderer/api/types'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  COLLATERAL_PREP_FEE_BUFFER_DUFFS,
  MASTERNODE_COLLATERAL_PREP_COPY,
} from '@renderer/constants/masternodeCollateralPrep'
import { EVO_MASTERNODE_TYPE, MASTERNODE_COLLATERAL_DUFFS } from '@renderer/constants/masternodes'
import type {
  CollateralInvoiceSyncPlan,
  CollateralPrepCoinMode,
  CollateralPrepSummary,
} from '@renderer/types/MasternodeCollateralPrep'
import type { DropdownFieldOption } from '@renderer/types/DropdownField'
import type { FeeSelectableUtxo, MasternodeType } from '@renderer/types/MasternodeRegistrationWizard'
import type { ReceiveRequestDto } from '@renderer/types/ReceiveRequest'
import { davToDash } from '@renderer/utils/balance'
import { receiveCoreAddresses } from '@renderer/utils/receiveDefaults'

export function requiredCollateralDuffs(type: MasternodeType): bigint {
  return MASTERNODE_COLLATERAL_DUFFS[type]
}

export function prepOutpointKey(utxo: Pick<SelectableUtxo, 'txid' | 'vout'>): string {
  return `${utxo.txid}:${utxo.vout}`
}

export function spendablePrepUtxos(utxos: FeeSelectableUtxo[]): FeeSelectableUtxo[] {
  return utxos
    .filter(utxo => !utxo.isLocked && utxo.collateral !== true)
    .sort((a, b) => {
      const confDiff = (b.height > 0 ? 1 : 0) - (a.height > 0 ? 1 : 0)
      if (confDiff !== 0) return confDiff
      return a.satoshis < b.satoshis ? 1 : a.satoshis > b.satoshis ? -1 : 0
    })
}

export function spendablePrepTotal(utxos: FeeSelectableUtxo[]): bigint {
  return spendablePrepUtxos(utxos).reduce((sum, utxo) => sum + utxo.satoshis, 0n)
}

export function autoSelectCollateralPrepUtxos(
  utxos: FeeSelectableUtxo[],
  requiredDuffs: bigint,
  feeBufferDuffs: bigint = COLLATERAL_PREP_FEE_BUFFER_DUFFS,
): string[] {
  const candidates = spendablePrepUtxos(utxos)
  const targetWithFee = requiredDuffs + feeBufferDuffs
  const picked: string[] = []
  let total = 0n
  for (const utxo of candidates) {
    picked.push(prepOutpointKey(utxo))
    total += utxo.satoshis
    if (total >= targetWithFee) break
  }
  return picked
}

export function resolveCollateralPrepSelectedKeys(
  mode: CollateralPrepCoinMode,
  coins: FeeSelectableUtxo[],
  requiredDuffs: bigint,
  manualKeys: ReadonlyArray<string>,
): string[] {
  if (mode === 'auto') {
    return autoSelectCollateralPrepUtxos(coins, requiredDuffs)
  }
  const validKeys = new Set(coins.map(prepOutpointKey))
  return manualKeys.filter(key => validKeys.has(key))
}

export function summarizeCollateralPrepSelection(
  utxos: FeeSelectableUtxo[],
  selectedKeys: ReadonlySet<string>,
  requiredDuffs: bigint,
  feeDuffs: bigint | null,
): CollateralPrepSummary {
  const selected = utxos.filter(utxo => selectedKeys.has(prepOutpointKey(utxo)))
  const selectedTotal = selected.reduce((sum, utxo) => sum + utxo.satoshis, 0n)

  if (selectedTotal < requiredDuffs) {
    return {
      requiredDuffs,
      selectedCount: selected.length,
      selectedTotal,
      feeDuffs,
      changeDuffs: null,
      shortfallDuffs: requiredDuffs - selectedTotal,
      enough: false,
    }
  }

  if (feeDuffs == null) {
    return {
      requiredDuffs,
      selectedCount: selected.length,
      selectedTotal,
      feeDuffs: null,
      changeDuffs: null,
      shortfallDuffs: 0n,
      enough: false,
    }
  }

  const needed = requiredDuffs + feeDuffs
  if (selectedTotal < needed) {
    return {
      requiredDuffs,
      selectedCount: selected.length,
      selectedTotal,
      feeDuffs,
      changeDuffs: null,
      shortfallDuffs: needed - selectedTotal,
      enough: false,
    }
  }

  return {
    requiredDuffs,
    selectedCount: selected.length,
    selectedTotal,
    feeDuffs,
    changeDuffs: selectedTotal - needed,
    shortfallDuffs: 0n,
    enough: true,
  }
}

export function resolveCreatedCollateralOutpoint(
  txid: string,
  requiredDuffs: bigint,
  updatedUtxos: ReadonlyArray<Pick<SelectableUtxo, 'txid' | 'vout' | 'satoshis'>>,
): string {
  const exact = updatedUtxos.find(utxo => utxo.txid === txid && utxo.satoshis === requiredDuffs)
  return exact != null ? `${exact.txid}:${exact.vout}` : `${txid}:0`
}

export function defaultCollateralLabel(type: MasternodeType): string {
  return type === EVO_MASTERNODE_TYPE
    ? MASTERNODE_COLLATERAL_PREP_COPY.defaultEvoLabel
    : MASTERNODE_COLLATERAL_PREP_COPY.defaultRegularLabel
}

export function pickFreshCollateralTargetAddress(
  receiving: ReadonlyArray<WalletAddressDto>,
  claimedAddresses: ReadonlySet<string>,
  labelsByAddress: ReadonlyMap<string, string>,
): string | null {
  const clean = receiveCoreAddresses([...receiving]).find(addr =>
    !claimedAddresses.has(addr.address)
    && !labelsByAddress.has(addr.address),
  )
  return clean?.address ?? null
}

export function fallbackCollateralTargetAddress(receiving: ReadonlyArray<WalletAddressDto>): string {
  return receiveCoreAddresses([...receiving])[0]?.address
    ?? receiving.find(addr => !addr.isLocked)?.address
    ?? receiving[0]?.address
    ?? ''
}

export function nextCollateralLabelOnAddressChange(
  prevAddress: string,
  nextAddress: string,
  currentLabel: string,
  badgeFor: (address: string) => string | undefined,
  type: MasternodeType,
): string {
  const nextExisting = badgeFor(nextAddress.trim())?.trim() ?? ''
  if (nextExisting !== '') return nextExisting

  const prevExisting = badgeFor(prevAddress.trim())?.trim() ?? ''
  const trimmedCurrent = currentLabel.trim()
  if (trimmedCurrent === '' || trimmedCurrent === prevExisting) {
    return defaultCollateralLabel(type)
  }
  return currentLabel
}

export function collateralTargetAddressOptions(
  receiving: ReadonlyArray<WalletAddressDto>,
  claimedAddresses: ReadonlySet<string>,
  labelsByAddress: ReadonlyMap<string, string>,
): DropdownFieldOption[] {
  const fresh = receiveCoreAddresses([...receiving])
  const pool = fresh.length > 0 ? fresh : receiving.filter(addr => !addr.isLocked)
  const clean: WalletAddressDto[] = []
  const labeled: WalletAddressDto[] = []
  for (const addr of pool) {
    const existingLabel = labelsByAddress.get(addr.address)?.trim() ?? ''
    if (claimedAddresses.has(addr.address) || existingLabel !== '') {
      labeled.push(addr)
    } else {
      clean.push(addr)
    }
  }
  return [...clean, ...labeled].map(addr => {
    const badge = labelsByAddress.get(addr.address)?.trim() || undefined
    return {
      value: addr.address,
      label: addr.address,
      ...(badge ? { badge } : {}),
      description: 'Your receiving address',
      metadata: [`${davToDash(addr.balance)} ${DASH_UNIT}`, `Tx count: ${addr.txCount}`],
    }
  })
}

export function planCollateralInvoiceSync(
  address: string,
  label: string,
  requiredDuffs: bigint,
  requests: ReadonlyArray<Pick<ReceiveRequestDto, 'id' | 'address' | 'label' | 'amountDuffs'>>,
): CollateralInvoiceSyncPlan {
  const trimmedAddress = address.trim()
  const trimmedLabel = label.trim()
  const existing = requests.find(req => req.address === trimmedAddress) ?? null

  if (existing == null) {
    return {
      deleteRequestId: null,
      createRequest: trimmedLabel !== '' ? { label: trimmedLabel, amountDuffs: requiredDuffs } : null,
    }
  }

  const existingLabel = existing.label?.trim() ?? ''
  if (trimmedLabel === existingLabel) {
    return { deleteRequestId: null, createRequest: null }
  }

  return {
    deleteRequestId: existing.id,
    createRequest: trimmedLabel !== ''
      ? { label: trimmedLabel, amountDuffs: existing.amountDuffs ?? requiredDuffs }
      : null,
  }
}
