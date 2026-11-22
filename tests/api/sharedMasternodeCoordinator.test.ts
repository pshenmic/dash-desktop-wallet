import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Output, PrivateKey, Transaction, TransactionType} from 'dash-core-sdk'
import {MasternodeDAO} from '../../src/main/src/database/MasternodeDAO'
import {MasternodeIdentityDAO} from '../../src/main/src/database/MasternodeIdentityDAO'
import {Preferences} from '../../src/main/src/preferences'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {NetworkMasternode, SharedRegistrationDraft} from '../../src/main/src/types/Masternode'
import {UTXO} from '../../src/main/src/types/UTXO'
import {masternodeKeyDeriver} from '../../src/main/src/utils/masternodeKeys'
import {nodeKeyValues} from '../../src/main/src/utils/masternodes'
import {harness, Harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const {getTransaction} = vi.hoisted(() => ({getTransaction: vi.fn()}))
vi.mock('../../src/main/src/utils/coreSDK', () => ({coreSDK: () => ({getTransaction})}))

const DASH = 100_000_000n
const FUNDING_A = 'aa'.repeat(32)
const FUNDING_B = 'bb'.repeat(32)
const OPERATOR = 'b1861e7cebdb77ae860788edf2d8b80fda62bcd4647a4cee6841b753b7c438b4c084554b2d71703891092b6d9e509f05'

function node(proTxHash: string, fields: Partial<NetworkMasternode>): NetworkMasternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: null,
    collateralTxid: 'ee'.repeat(32), collateralVout: 0, collateralAddress: 'Xnobody',
    serviceAddress: '1.2.3.4:9999', payeeAddress: 'Xpayee', ownerAddress: 'Xnobody', votingAddress: 'Xvoting',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: null, lastPaidTime: null, registeredHeight: 100, isShared: false, shares: [], ...fields,
  }
}

describe('shared registration coordinator', () => {
  let wired: Harness
  let walletId: string
  let keys: Parameters<typeof masternodeKeyDeriver>[0]
  let utxos: UTXO[]
  let network: NetworkMasternode[]
  let masternodes: MasternodeService
  let draft: SharedRegistrationDraft

  beforeEach(async () => {
    getTransaction.mockReset()
    wired = await harness()
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)
    keys = (await wired.masternodeKeyDAO.getKeys(walletId))!
    utxos = []
    network = []
    const provider = {
      ensureReady: async () => undefined,
      ensureReadyToList: async () => undefined,
      getWalletUtxos: async () => utxos,
      getMasternodes: async (filter: 'owner' | 'voting' | 'operator' | 'collateral', values: string[]) =>
        network.filter(entry => nodeKeyValues(filter, entry).some(key => values.includes(key))),
      watchMasternodes: async () => [],
    }
    const providers = {forWallet: () => provider} as unknown as WalletProviderFactory
    const walletSync = {
      getListedMasternodes: () => null,
      refreshListedMasternodes: () => undefined,
      broadcastTransaction: async () => ({txid: 'ff'.repeat(32), peersDelivered: ['1.2.3.4:9999']}),
    } as unknown as WalletSyncService
    masternodes = new MasternodeService(
      wired.walletDAO, wired.masternodeKeyDAO, new MasternodeDAO(wired.knex), new MasternodeIdentityDAO(wired.knex),
      providers, wired.addressDAO, new CoreTransactionService(), walletSync, Preferences.default(),
    )

    const owner = (index: number): string => masternodeKeyDeriver(keys, 'mainnet', 'owner').derive(index).address
    const [{address}, second] = (await wired.addressDAO.getAddressesByWalletId(walletId)).receiving
    const script = Output.createP2PKH(0n, address).script
    const parent = (satoshis: bigint, to: string): {transaction: Uint8Array} => ({
      transaction: new Transaction([], [Output.createP2PKH(satoshis, to)], 0, 3, TransactionType.TRANSACTION_NORMAL).bytes(),
    })
    getTransaction.mockImplementation(async (txid: string) => {
      if (txid === FUNDING_A) return parent(60_000_100_000n, address)
      if (txid === FUNDING_B) return parent(40_000_050_000n, address)
      throw new Error(`Tx ${txid} not found`)
    })
    utxos = [
      {address, satoshis: 60_000_100_000n, script, txId: FUNDING_A, vOut: 0, height: 1, timestamp: null, confirmations: 1, isLocked: false},
      {address, satoshis: 40_000_050_000n, script, txId: FUNDING_B, vOut: 0, height: 1, timestamp: null, confirmations: 1, isLocked: false},
    ]
    draft = {
      members: [
        {amountDuffs: 600n * DASH, ownerAddress: owner(0), refundAddress: address, rewardAddress: null, changeAddress: address, inputs: [{txid: FUNDING_A, vout: 0}]},
        {amountDuffs: 400n * DASH, ownerAddress: owner(1), refundAddress: second.address, rewardAddress: null, changeAddress: second.address, inputs: [{txid: FUNDING_B, vout: 0}]},
      ],
      serviceAddress: '1.2.3.4:9999',
      operatorPublicKey: OPERATOR,
      votingAddress: PrivateKey.fromBytes(new Uint8Array(32).fill(9), 'mainnet').getAddress(),
      operatorReward: 0,
      earlyPeriodBlocks: 1_000,
      earlyPenaltyDuffs: 1_000_000n,
      feeDuffs: 100_000n,
    }
  })

  it('builds a plan whose inputs resolve through DAPI', async () => {
    const plan = await masternodes.buildSharedRegistration(walletId, draft)

    expect(plan.members.map(member => member.inputIndexes)).toEqual([[0], [1]])
    expect(Transaction.fromHex(plan.txHex).inputs).toHaveLength(2)
    expect(plan.collateralIndex).toBe(1)
    expect(plan.actualFeeDuffs).toBe(100_000n)
    expect(getTransaction).toHaveBeenCalledWith(FUNDING_A)
    expect(getTransaction).toHaveBeenCalledWith(FUNDING_B)
  })

  it('refuses when a funding parent cannot be read', async () => {
    getTransaction.mockRejectedValue(new Error('unavailable'))

    await expect(masternodes.buildSharedRegistration(walletId, draft)).rejects.toThrow('not available')
  })

  it('refuses an operator key a listed node already carries', async () => {
    network = [node('x', {operatorPublicKey: OPERATOR})]

    await expect(masternodes.buildSharedRegistration(walletId, draft)).rejects.toThrow('operator key')
  })

  it('refuses a share owner key a listed node already carries', async () => {
    network = [node('x', {ownerAddress: draft.members[0].ownerAddress})]

    await expect(masternodes.buildSharedRegistration(walletId, draft)).rejects.toThrow('member 1')
  })
})
