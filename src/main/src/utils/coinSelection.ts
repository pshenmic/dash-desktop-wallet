import {CoinSelectionResult, CoreFeeForInputs, CoreSpendSource, SelectableUtxo} from '../types/CoinSelection'

const bySatoshisDesc = (a: SelectableUtxo, b: SelectableUtxo): number =>
  a.satoshis < b.satoshis ? 1 : a.satoshis > b.satoshis ? -1 : 0

const totalOf = (utxos: SelectableUtxo[]): bigint =>
  utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0n)

// A pick names L1 coins, so it says nothing about an operation funded by
// platform credits, an identity balance or the pool. Refused rather than
// ignored: silently dropping it is what lets a quote and its send disagree.
export function requireAutomaticSelection(source?: CoreSpendSource | null): void {
  if (source != null) {
    throw new Error('Coin control applies to L1-funded operations only')
  }
}

export function selectCoins(
  utxos: SelectableUtxo[],
  target: bigint,
  feeForInputs: CoreFeeForInputs,
  source?: CoreSpendSource,
): CoinSelectionResult {
  if (target <= 0n) {
    throw new Error('Send amount must be greater than zero')
  }

  const unlocked = utxos.filter(utxo => !utxo.isLocked)

  // A picked set is spent whole rather than walked: stopping early would drop
  // coins the user asked to spend, which is the one thing picking them means.
  if (source?.kind === 'outpoints') {
    if (unlocked.length === 0 || unlocked.length !== utxos.length) {
      throw new Error('Insufficient funds to cover amount and network fee')
    }

    const inputTotal = totalOf(unlocked)
    const fee = feeForInputs(unlocked.length)
    const change = inputTotal - target - fee

    if (change < 0n) {
      throw new Error('Insufficient funds to cover amount and network fee')
    }

    return {inputs: [...unlocked], inputTotal, fee, change}
  }

  const sorted = [...unlocked].sort(bySatoshisDesc)

  const selected: SelectableUtxo[] = []
  let inputTotal = 0n

  for (const utxo of sorted) {
    selected.push(utxo)
    inputTotal += utxo.satoshis

    const fee = feeForInputs(selected.length)
    const change = inputTotal - target - fee
    if (change >= 0n) {
      return { inputs: selected, inputTotal, fee, change }
    }
  }

  throw new Error('Insufficient funds to cover amount and network fee')
}

// Not the balance minus a fee: an input worth less than what it adds to the fee
// leaves the set able to send less, so the answer is the best prefix.
export function maxSelectableAmount(
  utxos: SelectableUtxo[],
  feeForInputs: CoreFeeForInputs,
  source?: CoreSpendSource,
): bigint {
  const unlocked = utxos.filter(utxo => !utxo.isLocked)

  // No prefix to choose from when every coin is spent: the price is the one the
  // picked count carries, whether or not a smaller set would have been cheaper.
  if (source?.kind === 'outpoints') {
    if (unlocked.length === 0 || unlocked.length !== utxos.length) return 0n
    const spendable = totalOf(unlocked) - feeForInputs(unlocked.length)
    return spendable > 0n ? spendable : 0n
  }

  const sorted = [...unlocked].sort(bySatoshisDesc)

  let inputTotal = 0n
  let max = 0n

  sorted.forEach((utxo, index) => {
    inputTotal += utxo.satoshis
    const spendable = inputTotal - feeForInputs(index + 1)
    if (spendable > max) max = spendable
  })

  return max
}
