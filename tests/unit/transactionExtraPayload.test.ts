import {describe, it, expect} from 'vitest'
import {Transaction as SDKTransaction, TransactionType, utils as sdkUtils} from 'dash-core-sdk'
import {buildAssetLockOutputs} from '../../src/main/src/utils/assetLockTx'
import {readExtraPayload} from '../../src/main/src/utils/transactionExtraPayload'

const creditAddress = sdkUtils.publicKeyHashToAddress(new Uint8Array(20).fill(9), 'testnet')

const assetLockBytes = (): Uint8Array => {
  const {extraPayload} = buildAssetLockOutputs(100_000n, creditAddress)
  return new SDKTransaction(undefined, undefined, 0, 3, TransactionType.TRANSACTION_ASSET_LOCK, extraPayload).bytes()
}

describe('readExtraPayload', () => {
  it('decodes a special transaction payload to the SDK JSON shape', () => {
    expect(readExtraPayload(assetLockBytes())).toEqual({
      type: 'AssetLockTx',
      payload: {
        version: 1,
        count: 1,
        outputs: [{satoshis: '100000', script: `OP_DUP OP_HASH160 OP_PUSHBYTES_20 ${'09'.repeat(20)} OP_EQUALVERIFY OP_CHECKSIG`}],
      },
    })
  })

  it('answers null for an ordinary transaction', () => {
    expect(readExtraPayload(new SDKTransaction(undefined, undefined, 0, 2).bytes())).toBeNull()
  })

  it('answers null for bytes too short to carry a type', () => {
    expect(readExtraPayload(new Uint8Array([3, 0]))).toBeNull()
  })

  // A stored row can predate this SDK, so a payload it cannot decode must not
  // take the whole history read down with it.
  it('answers null when the transaction fails to decode', () => {
    expect(readExtraPayload(new Uint8Array([3, 0, 8, 0]))).toBeNull()
  })
})
