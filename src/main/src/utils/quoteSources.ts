import {FeeOperation, FeeParams} from '../../platform/types/messages'
import {requireAutomaticSelection} from './coinSelection'
import {requireAutomaticInputs} from './platformTransfer'

// Which sources an operation may be quoted or previewed with: a pick names
// coins for the selection it funds, and nothing else. One matrix for the quote
// and the preview, so the two cannot admit different sets.
export function requireQuoteSources(operation: FeeOperation, params: Pick<FeeParams, 'coreSource' | 'platformSource'>): void {
  switch (operation) {
    case 'coreSend':
    case 'assetLockFunding':
    case 'assetLockShield':
    case 'identityRegister':
    case 'identityTopUpL1':
      requireAutomaticInputs(params.platformSource)
      return
    case 'addressFundsTransfer':
    case 'addressWithdrawal':
    case 'identityCreate':
    case 'identityTopUp':
    case 'shield':
      requireAutomaticSelection(params.coreSource)
      return
    case 'shieldedTransfer':
    case 'unshield':
    case 'shieldedWithdrawal':
    case 'identityCreateFromShielded':
    case 'identityToAddress':
    case 'identityToIdentity':
    case 'identityWithdrawal':
    case 'usernameRegister':
    case 'dashPayContactRequest':
    case 'identityUpdateKeys':
      requireAutomaticSelection(params.coreSource)
      requireAutomaticInputs(params.platformSource)
      return
  }
}
