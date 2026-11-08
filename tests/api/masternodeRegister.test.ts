import {beforeEach, describe, expect, it} from 'vitest'
import {secp256k1} from '@noble/curves/secp256k1.js'
import {concatBytes, hexToBytes} from '@noble/hashes/utils.js'
import {Script, Transaction, utils as sdkUtils} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {MasternodeDAO} from '../../src/main/src/database/MasternodeDAO'
import {Preferences} from '../../src/main/src/preferences'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {MasternodeKeyChain, MasternodeKeyFilter, MasternodeKeys, MasternodeRegistration, NetworkMasternode} from '../../src/main/src/types/Masternode'
import {UTXO} from '../../src/main/src/types/UTXO'
import {masternodeKeyDeriver} from '../../src/main/src/utils/masternodeKeys'
import {nodeKey} from '../../src/main/src/utils/masternodes'
import {proRegInputsHash, proRegSignString, signedMessageHash} from '../../src/main/src/utils/proRegTx'
import {harness, Harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const DASH = 100_000_000n

const p2pkhScript = (address: string): Script => {
  const script = new Script()
  script.pushOpCode('OP_DUP')
  script.pushOpCode('OP_HASH160')
  script.pushOpCode('OP_PUSHBYTES_20', sdkUtils.addressToPublicKeyHash(address))
  script.pushOpCode('OP_EQUALVERIFY')
  script.pushOpCode('OP_CHECKSIG')
  return script
}

const utxo = (address: string, satoshis: bigint, txId: string): UTXO =>
  ({address, satoshis, txId, vOut: 0, script: p2pkhScript(address), height: 1_000_000, timestamp: null, confirmations: 20})

function node(proTxHash: string, fields: Partial<NetworkMasternode>): NetworkMasternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: 0,
    collateralTxid: 'ee'.repeat(32), collateralVout: 0, collateralAddress: 'ynobody',
    serviceAddress: '1.2.3.4:19999', payeeAddress: 'ypayee', ownerAddress: 'ynobody', votingAddress: 'ynobody',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: 0, lastPaidTime: 0, registeredHeight: null, ...fields,
  }
}

const keyPair = new KeyPairController()

const EVO_FIELDS: Partial<MasternodeRegistration> & {platformNodeId: string} =
  {type: 'Evo', platformNodeId: '5b6ddd9532c5863b8bb113ef92d77f77b66f859b', platformP2PPort: 36656, platformHttpPort: 1443}

function payloadSigner(payload: ProRegTX): string {
  const signature = hexToBytes(payload.payloadSig)
  const recovered = concatBytes(Uint8Array.of((signature[0] - 27) & 3), signature.slice(1))
  const message = signedMessageHash(proRegSignString(payload, 'testnet'))
  return keyPair.p2pkhAddress(secp256k1.recoverPublicKey(recovered, message, {prehash: false}), 'testnet')
}

describe('MasternodeService.register', () => {
  let wired: Harness
  let walletId: string
  let keys: MasternodeKeys
  let owned: string[]
  let utxos: UTXO[]
  let list: NetworkMasternode[] | null
  let broadcast: string[]
  let masternodes: MasternodeService

  const key = (chain: MasternodeKeyChain, index: number): string =>
    masternodeKeyDeriver(keys, 'testnet', chain).derive(index).address

  const registration = (fields: Partial<MasternodeRegistration> = {}): MasternodeRegistration => ({
    type: 'Regular',
    collateral: {txid: 'cc'.repeat(32), vout: 0},
    serviceAddress: '203.0.113.7:19999',
    payoutAddress: owned[2],
    operatorReward: 0,
    platformNodeId: null,
    platformP2PPort: null,
    platformHttpPort: null,
    ...fields,
  })

  async function register(fields: Partial<MasternodeRegistration> = {}): Promise<{tx: Transaction; payload: ProRegTX; fee: bigint}> {
    const result = await masternodes.register(walletId, registration(fields), PASSWORD)
    const tx = Transaction.fromHex(broadcast.at(-1)!)
    expect(result.proTxHash).toBe(tx.hash())
    return {tx, payload: tx.extraPayload as ProRegTX, fee: result.fee}
  }

  beforeEach(async () => {
    wired = await harness()
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    keys = (await wired.masternodeKeyDAO.getKeys(walletId))!
    owned = (await wired.walletService.getAddressesByWalletId(walletId)).receiving.slice(0, 3).map(a => a.address)
    utxos = [utxo(owned[0], 1_000n * DASH, 'cc'.repeat(32)), utxo(owned[1], DASH, 'aa'.repeat(32))]
    list = []
    broadcast = []

    const provider = {
      ensureReady: async () => undefined,
      getWalletUtxos: async () => utxos,
      getMasternodes: async (filter: MasternodeKeyFilter, values: string[]) =>
        list?.filter(entry => values.includes(nodeKey(filter, entry) ?? '')) ?? null,
      watchMasternodes: async () => [],
    }
    const walletSync = {
      broadcastTransaction: async (hex: string) => {
        broadcast.push(hex)
        return {txid: Transaction.fromHex(hex).hash(), peersDelivered: ['peer']}
      },
    } as unknown as WalletSyncService
    masternodes = new MasternodeService(
      wired.walletDAO, wired.masternodeKeyDAO, new MasternodeDAO(wired.knex), {forWallet: () => provider} as unknown as WalletProviderFactory,
      wired.addressDAO, new CoreTransactionService(), walletSync, Preferences.default(),
    )
  })

  it('references the collateral, signs with its key and pays the fee from other coins', async () => {
    const {tx, payload, fee} = await register()

    expect(payload.version).toBe(2)
    expect(payload.type).toBe(0)
    expect(payload.collateralOutpoint).toMatchObject({txId: 'cc'.repeat(32), vOut: 0})
    expect(tx.inputs.map(input => input.txId)).toEqual(['aa'.repeat(32)])
    expect(payload.inputsHash).toBe(proRegInputsHash(tx.inputs))
    expect(payloadSigner(payload)).toBe(owned[0])
    expect(payload.getPayoutAddress('testnet')).toBe(owned[2])
    expect(payload.ipAddress).toBe('203.0.113.7')
    expect(payload.port).toBe(19999)
    expect(tx.outputs).toHaveLength(1)
    expect(fee).toBe(DASH - tx.outputs[0].satoshis)
    expect(fee).toBeGreaterThan(0n)
  })

  it('takes the lowest index of each chain no listed node carries', async () => {
    list = [node('11'.repeat(32), {ownerAddress: key('owner', 0), operatorPublicKey: key('operator', 0)})]
    const {payload} = await register()

    expect(payload.getOwnerAddress('testnet')).toBe(key('owner', 1))
    expect(payload.pubKeyOperator).toBe(key('operator', 1))
    expect(payload.getVotingAddress('testnet')).toBe(key('voting', 0))
  })

  it('carries the platform node id and ports an Evo is given', async () => {
    utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
    const {payload} = await register({type: 'Evo', platformNodeId: EVO_FIELDS.platformNodeId.toUpperCase(), platformP2PPort: 36656, platformHttpPort: 1443})

    expect(payload.type).toBe(1)
    expect(payload.platformNodeID).toBe(EVO_FIELDS.platformNodeId)
    expect([payload.platformP2PPort, payload.platformHTTPPort]).toEqual([36656, 1443])
  })

  it('refuses a collateral of the wrong amount for the type', async () => {
    await expect(masternodes.register(walletId, registration(EVO_FIELDS), PASSWORD))
      .rejects.toThrow('exactly 4000 DASH')
    expect(broadcast).toEqual([])
  })

  it('refuses an Evo without its platform node id', async () => {
    utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
    await expect(masternodes.register(walletId, registration({...EVO_FIELDS, platformNodeId: null}), PASSWORD))
      .rejects.toThrow('platform node id')
  })

  it('refuses a coin that already backs a masternode', async () => {
    list = [node('22'.repeat(32), {collateralTxid: 'cc'.repeat(32), collateralVout: 0, collateralAddress: owned[0]})]
    await expect(masternodes.register(walletId, registration(), PASSWORD)).rejects.toThrow('already a masternode collateral')
  })

  it('refuses before any list has arrived to tell which keys are free', async () => {
    list = null
    await expect(masternodes.register(walletId, registration(), PASSWORD)).rejects.toThrow('has not arrived')
  })
})
