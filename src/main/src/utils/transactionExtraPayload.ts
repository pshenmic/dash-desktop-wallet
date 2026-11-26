import {Transaction as SDKTransaction, TransactionType} from 'dash-core-sdk'
import type {TransactionExtraPayload} from '../types/Transaction'

// The first four bytes pack the version in the low half and the DIP-2 type in
// the high half. Only a special transaction carries a payload, after its lock
// time, so peeking at the type avoids decoding an ordinary payment.
export function readExtraPayload(raw: Uint8Array): TransactionExtraPayload | null {
  if (raw.byteLength < 4) return null

  const versionWithType = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getInt32(0, true)
  if (((versionWithType >> 16) & 0xffff) === TransactionType.TRANSACTION_NORMAL) return null

  try {
    const transaction = SDKTransaction.fromBytes(raw)
    const payload = transaction.toJSON().extraPayload
    if (payload == null) return null

    return {type: transaction.getExtraPayloadType() ?? null, payload: payload as unknown as Record<string, unknown>}
  } catch {
    return null
  }
}
