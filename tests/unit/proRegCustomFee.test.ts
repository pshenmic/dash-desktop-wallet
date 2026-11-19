import { describe, expect, it } from 'vitest'
import {
  ExtraPayload,
  Input,
  OutPoint,
  Output,
  PrivateKey,
  Transaction,
  TransactionType,
  utils as sdkUtils,
} from 'dash-core-sdk'
import type {
  ListedUtxo,
  MasternodeRegistrationPreviewDto,
  WalletAddressDto,
} from '@renderer/api/types'
import {
  MASTERNODE_CHANGE_ADDRESS_DESCRIPTION,
  MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION,
} from '@renderer/constants/masternodeAddresses'
import { REGISTER_WIZARD_COPY } from '@renderer/constants/masternodeRegistration'
import { PROREG_SEQUENCE_FINAL } from '@renderer/constants/masternodes'
import {
  buildCustomFeeProRegPreview,
  coreFeePerByteForMultiplier,
  eligibleCustomFeeUtxos,
  fundedFeeAddressOptions,
  proRegFeeDuffsForInputs,
} from '@renderer/utils/proRegCustomFee'

const TXID_1 = '11'.repeat(32)
const TXID_2 = '22'.repeat(32)
const TXID_3 = '33'.repeat(32)
const TXID_4 = '44'.repeat(32)
const COLLATERAL_TXID = 'aa'.repeat(32)

function testnetAddress(seedByte: number): string {
  return PrivateKey.fromBytes(Uint8Array.from({ length: 32 }, (_, i) => (i + seedByte) % 250 + 1), 'testnet', true).getAddress()
}

function testAddresses() {
  return {
    payout: testnetAddress(1),
    owner: testnetAddress(10),
    voting: testnetAddress(20),
    feeAddr: testnetAddress(30),
    otherAddr: testnetAddress(40),
  }
}

function makeBasePreview(addrs: ReturnType<typeof testAddresses>, defaultFeeCoin: ListedUtxo): MasternodeRegistrationPreviewDto {
  const payload = new ExtraPayload.ProRegTX(
    1,
    0,
    0,
    new OutPoint(COLLATERAL_TXID, 0),
    '45.67.89.10',
    19999,
    Buffer.from(sdkUtils.addressToPublicKeyHash(addrs.owner)).toString('hex'),
    'ab'.repeat(48),
    Buffer.from(sdkUtils.addressToPublicKeyHash(addrs.voting)).toString('hex'),
    500,
    Output.createP2PKH(0n, addrs.payout).script,
    '00'.repeat(32),
    undefined,
    undefined,
    undefined,
    '',
  )
  const tx = new Transaction(undefined, undefined, undefined, 3, TransactionType.TRANSACTION_PROVIDER_REGISTER, payload)
  tx.addInput(new Input(defaultFeeCoin.txid, defaultFeeCoin.vout, Output.createP2PKH(0n, defaultFeeCoin.address).script, PROREG_SEQUENCE_FINAL))
  const feeDuffs = proRegFeeDuffsForInputs(1, 1, payload.signedSize())
  tx.addOutput(Output.createP2PKH(defaultFeeCoin.satoshis - feeDuffs, defaultFeeCoin.address))
  payload.inputsHash = tx.providerInputsHash()

  return {
    type: 'Regular',
    collateral: { txid: COLLATERAL_TXID, vout: 0 },
    serviceAddress: '45.67.89.10:19999',
    payoutAddress: addrs.payout,
    operatorReward: 500,
    platformNodeId: null,
    platformP2PPort: null,
    platformHttpPort: null,
    unsignedHex: tx.hex(),
    inputs: [{ role: 'feeInput', address: defaultFeeCoin.address, amount: defaultFeeCoin.satoshis, unit: 'duffs', reference: `${defaultFeeCoin.txid}:${defaultFeeCoin.vout}` }],
    outputs: [{ role: 'change', address: defaultFeeCoin.address, amount: defaultFeeCoin.satoshis - feeDuffs, unit: 'duffs', reference: null }],
    feeDuffs,
    ownerAddress: addrs.owner,
    votingAddress: addrs.voting,
    operatorPublicKey: 'ab'.repeat(48),
    ownerKeyIndex: 0,
    votingKeyIndex: 0,
    operatorKeyIndex: 0,
  }
}

function makeUtxo(partial: Partial<ListedUtxo> & { txid: string; address: string; satoshis: bigint }): ListedUtxo {
  return {
    vout: 0,
    height: 100,
    timestamp: new Date(1_700_000_000_000),
    confirmations: 6,
    isLocked: false,
    collateral: false,
    ...partial,
  }
}

describe('proRegCustomFee', () => {
  it('snaps fee multipliers onto the Fibonacci rate sequence', () => {
    expect(coreFeePerByteForMultiplier(1)).toBe(1)
    expect(coreFeePerByteForMultiplier(1.5)).toBe(2)
    expect(coreFeePerByteForMultiplier(2)).toBe(2)
    expect(coreFeePerByteForMultiplier(2.5)).toBe(3)
    expect(coreFeePerByteForMultiplier(4)).toBe(5)
    expect(coreFeePerByteForMultiplier(Number.NaN)).toBe(1)
  })

  it('rebuilds ProRegTx using only confirmed, unlocked, non-collateral coins on the chosen address', () => {
    const addrs = testAddresses()
    const autoCoin = makeUtxo({ txid: TXID_1, address: addrs.otherAddr, satoshis: 50_000n })
    const customSmall = makeUtxo({ txid: TXID_2, address: addrs.feeAddr, satoshis: 20_000n })
    const unconfirmed = makeUtxo({ txid: TXID_3, address: addrs.feeAddr, satoshis: 100_000n, height: 0, confirmations: 0 })
    const locked = makeUtxo({ txid: TXID_4, address: addrs.feeAddr, satoshis: 200_000n, isLocked: true })
    const collateralCoin = makeUtxo({ txid: COLLATERAL_TXID, address: addrs.feeAddr, satoshis: 100_000_000_000n })

    const allUtxos = [autoCoin, customSmall, unconfirmed, locked, collateralCoin]
    expect(eligibleCustomFeeUtxos(allUtxos, addrs.feeAddr, { txid: COLLATERAL_TXID, vout: 0 })).toEqual([customSmall])

    const basePreview = makeBasePreview(addrs, autoCoin)
    const built = buildCustomFeeProRegPreview({
      basePreview,
      feeAddress: addrs.feeAddr,
      utxos: allUtxos,
      collateral: { txid: COLLATERAL_TXID, vout: 0 },
      coreFeeMultiplier: 1,
      network: 'testnet',
    })

    expect(built.error).toBeNull()
    expect(built.preview).not.toBeNull()
    const rebuiltTx = Transaction.fromHex(built.preview!.unsignedHex)
    const rebuiltPayload = rebuiltTx.extraPayload as InstanceType<typeof ExtraPayload.ProRegTX>

    expect(rebuiltTx.inputs).toHaveLength(1)
    expect(rebuiltTx.inputs[0].txId).toBe(TXID_2)
    expect(rebuiltTx.inputs[0].sequence).toBe(PROREG_SEQUENCE_FINAL)
    expect(rebuiltTx.inputs[0].scriptSig.hex()).toBe(Output.createP2PKH(0n, addrs.feeAddr).script.hex())
    expect(rebuiltTx.outputs).toHaveLength(1)
    expect(rebuiltTx.outputs[0].getAddress('testnet')).toBe(addrs.feeAddr)
    expect(rebuiltPayload.payloadSig).toBe('')
    expect(rebuiltPayload.inputsHash).toBe(rebuiltTx.providerInputsHash())
    expect(built.preview!.feeDuffs + rebuiltTx.outputs[0].satoshis).toBe(20_000n)
  })

  it('folds dust change (< 546 duffs) into the fee with zero outputs', () => {
    const addrs = testAddresses()
    const autoCoin = makeUtxo({ txid: TXID_1, address: addrs.otherAddr, satoshis: 50_000n })
    const basePreview = makeBasePreview(addrs, autoCoin)
    const baseTx = Transaction.fromHex(basePreview.unsignedHex)
    const quoted = proRegFeeDuffsForInputs(1, 1, (baseTx.extraPayload as InstanceType<typeof ExtraPayload.ProRegTX>).signedSize())
    const dustCoin = makeUtxo({ txid: TXID_2, address: addrs.feeAddr, satoshis: quoted + 300n })

    const built = buildCustomFeeProRegPreview({
      basePreview,
      feeAddress: addrs.feeAddr,
      utxos: [autoCoin, dustCoin],
      collateral: { txid: COLLATERAL_TXID, vout: 0 },
      coreFeeMultiplier: 1,
      network: 'testnet',
    })

    expect(built.error).toBeNull()
    expect(built.preview!.outputs).toEqual([])
    expect(built.preview!.feeDuffs).toBe(quoted + 300n)
    const parsed = Transaction.fromHex(built.preview!.unsignedHex)
    expect(parsed.outputs).toHaveLength(0)
  })

  it('rejects invalid addresses, addresses with no eligible UTXOs, or insufficient funds', () => {
    const addrs = testAddresses()
    const autoCoin = makeUtxo({ txid: TXID_1, address: addrs.otherAddr, satoshis: 50_000n })
    const basePreview = makeBasePreview(addrs, autoCoin)

    expect(buildCustomFeeProRegPreview({
      basePreview,
      feeAddress: '',
      utxos: [autoCoin],
      collateral: { txid: COLLATERAL_TXID, vout: 0 },
      coreFeeMultiplier: 1,
      network: 'testnet',
    }).error).toBe(REGISTER_WIZARD_COPY.customFeesInvalidAddress)

    expect(buildCustomFeeProRegPreview({
      basePreview,
      feeAddress: addrs.feeAddr,
      utxos: [autoCoin],
      collateral: { txid: COLLATERAL_TXID, vout: 0 },
      coreFeeMultiplier: 1,
      network: 'testnet',
    }).error).toBe(REGISTER_WIZARD_COPY.customFeesNoEligibleCoins)

    const tinyCoin = makeUtxo({ txid: TXID_2, address: addrs.feeAddr, satoshis: 50n })
    expect(buildCustomFeeProRegPreview({
      basePreview,
      feeAddress: addrs.feeAddr,
      utxos: [autoCoin, tinyCoin],
      collateral: { txid: COLLATERAL_TXID, vout: 0 },
      coreFeeMultiplier: 1,
      network: 'testnet',
    }).error).toBe(REGISTER_WIZARD_COPY.customFeesInsufficient)
  })

  it('lists funded receiving and change addresses (including unlabeled used ones) sorted by spendable DASH', () => {
    const addrs = testAddresses()
    const makeWalletAddr = (address: string, overrides: Partial<WalletAddressDto> = {}): WalletAddressDto => ({
      walletId: 'w1',
      accountId: 0,
      address,
      derivationPath: "m/44'/1'/0'/0/0",
      index: 0,
      isChange: 0,
      isUsed: true,
      isLocked: false,
      balance: 0n,
      txCount: 1,
      label: null,
      usdBalance: null,
      ...overrides,
    })

    const receiving: WalletAddressDto[] = [
      makeWalletAddr(addrs.feeAddr, { balance: 10_000_000n }),
      makeWalletAddr(addrs.otherAddr, { balance: 10_000_000n, isLocked: true }),
      makeWalletAddr(addrs.owner, { isUsed: false, balance: 0n, txCount: 0 }),
    ]
    const change: WalletAddressDto[] = [
      makeWalletAddr(addrs.voting, { isChange: 1, balance: 50_000_000n }),
    ]
    const utxos = [
      makeUtxo({ txid: TXID_1, address: addrs.feeAddr, satoshis: 10_000_000n }),
      makeUtxo({ txid: TXID_2, address: addrs.voting, satoshis: 50_000_000n }),
      makeUtxo({ txid: TXID_3, address: addrs.otherAddr, satoshis: 10_000_000n }),
      makeUtxo({ txid: TXID_4, address: addrs.payout, satoshis: 20_000_000n, height: 0 }),
    ]

    const funded = fundedFeeAddressOptions(receiving, change, new Map([[addrs.feeAddr, 'Vault']]), utxos, null)
    expect(funded.map(item => item.value)).toEqual([addrs.voting, addrs.feeAddr])
    expect(funded[0].badge).toBeUndefined()
    expect(funded[0].description).toBe(MASTERNODE_CHANGE_ADDRESS_DESCRIPTION)
    expect(funded[0].metadata).toEqual(['0.5 Dash', '1 UTXO'])
    expect(funded[1].badge).toBe('Vault')
    expect(funded[1].description).toBe(MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION)
    expect(funded[1].metadata).toEqual(['0.1 Dash', '1 UTXO'])
  })
})
