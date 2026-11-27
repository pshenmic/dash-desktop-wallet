import {PlatformTransaction, PlatformTransactionPart} from '../types/PlatformTransaction'

const total = (parts: PlatformTransactionPart[]): bigint =>
  parts.reduce((sum, part) => sum + part.amount, 0n)

// A shielded transaction moved what it paid, not the note behind it.
export function shieldedTransactionAmount(
  transaction: PlatformTransaction,
  shieldedAddresses: ReadonlySet<string>,
  changeAddress: string | null,
): PlatformTransaction {
  if (!transaction.type.includes('SHIELD')) return transaction

  const received = transaction.recipient.filter(part => shieldedAddresses.has(part.source))
  const spent = transaction.sender.filter(part => shieldedAddresses.has(part.source))

  if (transaction.type === 'SHIELD' || transaction.type === 'SHIELD_FROM_ASSET_LOCK') {
    // A platform surplus beside the note is the funding address's change.
    const notes = total(received)
    return notes > 0n ? {...transaction, amountCredits: notes} : transaction
  }

  // Change exists only when this wallet spent notes; a receive has none.
  const paid = transaction.recipient.filter(part =>
    !(spent.length > 0 && part.source === changeAddress))
  const paidTotal = total(paid)
  if (paidTotal > 0n) return {...transaction, amountCredits: paidTotal}

  // Only change came back: what left is the spend minus change and fee.
  if (spent.length > 0) {
    const change = transaction.recipient.filter(part => part.source === changeAddress)
    const movement = total(spent) - total(change) - transaction.gasCredits
    return {...transaction, amountCredits: movement > 0n ? movement : 0n}
  }

  return transaction
}
