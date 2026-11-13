import type {Knex} from 'knex'
import {PaymentRequest} from '../types/PaymentRequest'
import {isConstraintViolation} from './errors'

function fromRow({id, wallet_id, address, amount_duffs, label, message, created_at}): PaymentRequest {
  return {
    id,
    walletId: wallet_id,
    address,
    amountDuffs: amount_duffs == null ? null : BigInt(amount_duffs),
    label,
    message,
    createdAt: created_at,
  }
}

export class PaymentRequestDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getRequests = async (walletId: string): Promise<PaymentRequest[]> => {
    const rows = await this.knex('payment_requests')
      .select('id', 'wallet_id', 'address', 'amount_duffs', 'label', 'message', 'created_at')
      .where('wallet_id', walletId)
      .orderBy('created_at', 'desc')
    return rows.map(fromRow)
  }

  insertRequest = async (walletId: string, address: string, amountDuffs: bigint | null, label: string | null, message: string | null, createdAt: number): Promise<void> => {
    try {
      await this.knex('payment_requests').insert({
        wallet_id: walletId,
        address,
        amount_duffs: amountDuffs?.toString() ?? null,
        label,
        message,
        created_at: createdAt,
      })
    } catch (error) {
      // The only constraint a well-formed insert can violate is the
      // (wallet_id, address) unique index — one active request per address.
      if (isConstraintViolation(error)) {
        throw new Error('This address already has a payment request')
      }
      throw error
    }
  }

  deleteRequest = async (walletId: string, id: number): Promise<void> => {
    const result = await this.knex('payment_requests').where({wallet_id: walletId, id}).delete()
    if (result === 0) {
      throw new Error('Payment request not found')
    }
  }
}
