import {Input, Output, Script, Transaction} from 'dash-core-sdk'
import {CORE_FEE_PER_BYTE} from '../constants/fee/core'

// Consensus rejects a withdrawal whose coreFeePerByte is not a non-zero
// Fibonacci number, so a multiplied rate has to be snapped onto the sequence.
export function coreFeePerByte(multiplier: number): number {
  const target = CORE_FEE_PER_BYTE * multiplier

  let rate = 1
  let next = 1
  while (rate < target) {
    const sum = rate + next
    rate = next
    next = sum
  }

  return rate
}

export function coreFeeDuffsFor(multiplier: number, inputsCount: number, outputsCount: number, withChange: boolean, payloadBytes = 0): bigint {
  const feePerByte = coreFeePerByte(multiplier)

  // dummy script which bigger than 99% of sigs
  const dummyScript = new Script(`OP_PUSHDATA1 ${'0'.repeat(288)}`)

  const tx = new Transaction(
    Array.from({length: inputsCount}, () => new Input('0'.repeat(64), 1, dummyScript, 0)),
    Array.from({length: outputsCount}, () => new Output(1n, dummyScript)),
    0,
    0,
  )

  if (withChange) {
    tx.outputs.push(Output.createP2PKH(1n, '111111111111111111111111133izVn'))
  }

  return BigInt((tx.signedSize() + payloadBytes) * feePerByte)
}
