import type { SelectableUtxo } from '@renderer/api/types'
import { COLLATERAL_PREP_FEE_BUFFER_DUFFS } from '@renderer/constants/masternodeCollateralPrep'
import { MASTERNODE_COLLATERAL_DUFFS } from '@renderer/constants/masternodes'
import type { CollateralPrepSummary } from '@renderer/types/MasternodeCollateralPrep'
import type { FeeSelectableUtxo, MasternodeType } from '@renderer/types/MasternodeRegistrationWizard'

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
