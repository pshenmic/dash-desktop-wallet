import {beforeEach, describe, expect, it} from 'vitest'
import {secp256k1} from '@noble/curves/secp256k1.js'
import {concatBytes, hexToBytes} from '@noble/hashes/utils.js'
import {Script, Transaction, utils as sdkUtils} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {ProUpRegTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRegTx.js'
import {ProUpRevTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRevTx.js'
import {ProUpServTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpServTx.js'
import {bls12_381} from '@noble/curves/bls12-381.js'
import {bytesToHex} from '@noble/hashes/utils.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {MasternodeDAO} from '../../src/main/src/database/MasternodeDAO'
import {Preferences} from '../../src/main/src/preferences'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {
  MasternodeKeyChain,
  MasternodeKeyFilter,
  MasternodeKeys,
  MasternodeRegistrarUpdate,
  MasternodeRegistration,
  MasternodeServiceUpdate,
  NetworkMasternode,
} from '../../src/main/src/types/Masternode'
import {UTXO} from '../../src/main/src/types/UTXO'
import {masternodeKeyDeriver} from '../../src/main/src/utils/masternodeKeys'
import {nodeKey} from '../../src/main/src/utils/masternodes'
import {payloadDigest, proRegSignString, providerInputsHash, signedMessageHash} from '../../src/main/src/utils/providerTx'
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

function payloadSigner(payload: ProRegTX | ProUpRegTx): string {
  const signature = hexToBytes(payload.payloadSig)
  const recovered = concatBytes(Uint8Array.of((signature[0] - 27) & 3), signature.slice(1))
  const hash = payload instanceof ProRegTX ? signedMessageHash(proRegSignString(payload, 'testnet')) : payloadDigest(payload)
  return keyPair.p2pkhAddress(secp256k1.recoverPublicKey(recovered, hash, {prehash: false}), 'testnet')
}

const keyIdOf = (address: string): string => bytesToHex(sdkUtils.addressToPublicKeyHash(address))

describe('MasternodeService provider transactions', () => {
  let wired: Harness
  let walletId: string
  let keys: MasternodeKeys
  let owned: string[]
  let utxos: UTXO[]
  let list: NetworkMasternode[] | null
  let broadcast: string[]
  // Nodes the source still returns but the network's list no longer carries.
  let gone: Set<string>
  let v24Active: boolean
  let masternodes: MasternodeService

  const key = (chain: MasternodeKeyChain, index: number): string =>
    masternodeKeyDeriver(keys, 'testnet', chain).derive(index).address

  const registration = (fields: Partial<MasternodeRegistration> = {}): MasternodeRegistration => ({
    type: 'Regular',
    collateral: {txid: 'cc'.repeat(32), vout: 0},
    serviceAddress: '45.33.12.7:19999',
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
    gone = new Set()
    v24Active = true

    const provider = {
      ensureReady: async () => undefined,
      getWalletUtxos: async () => utxos,
      getMasternodes: async (filter: MasternodeKeyFilter, values: string[]) =>
        list?.filter(entry => values.includes(nodeKey(filter, entry) ?? '')) ?? null,
      watchMasternodes: async () => [],
    }
    const walletSync = {
      getListedMasternodes: () => ({proTxHashes: new Set((list ?? []).map(({proTxHash}) => proTxHash).filter(hash => !gone.has(hash))), askedAt: 0, v24Active}),
      refreshListedMasternodes: () => undefined,
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
    expect(payload.inputsHash).toBe(providerInputsHash(tx.inputs))
    expect(payloadSigner(payload)).toBe(owned[0])
    expect(payload.getPayoutAddress('testnet')).toBe(owned[2])
    expect(payload.ipAddress).toBe('45.33.12.7')
    expect(payload.port).toBe(19999)
    expect(tx.outputs).toHaveLength(1)
    expect(fee).toBe(DASH - tx.outputs[0].satoshis)
    expect(fee).toBeGreaterThan(0n)
  })

  // A node not confirmed yet lists its voting and operator keys but no owner key.
  it('takes one index for all three keys, the lowest no listed node carries on any chain', async () => {
    list = [node('11'.repeat(32), {ownerAddress: null, votingAddress: key('voting', 0), operatorPublicKey: key('operator', 0)})]
    const {payload} = await register()

    expect(payload.getOwnerAddress('testnet')).toBe(key('owner', 1))
    expect(payload.pubKeyOperator).toBe(key('operator', 1))
    expect(payload.getVotingAddress('testnet')).toBe(key('voting', 1))
  })

  it('carries the platform node id and ports an Evo is given', async () => {
    utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
    const {payload} = await register({type: 'Evo', platformNodeId: EVO_FIELDS.platformNodeId.toUpperCase(), platformP2PPort: 36656, platformHttpPort: 1443})

    expect(payload.type).toBe(1)
    expect(payload.platformNodeID).toBe(EVO_FIELDS.platformNodeId)
    expect([payload.platformP2PPort, payload.platformHTTPPort]).toEqual([36656, 1443])
  })

  // Core reads a collateral from the UTXO set only, so peers drop the tx silently.
  it('refuses a collateral still in the mempool', async () => {
    utxos[0] = {...utxo(owned[0], 1_000n * DASH, 'cc'.repeat(32)), height: 0, confirmations: 0}
    await expect(masternodes.register(walletId, registration(), PASSWORD)).rejects.toThrow('needs a confirmation')
    expect(broadcast).toEqual([])
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
  describe('updateRegistrar', () => {
    const PRO_TX_HASH = '11'.repeat(32)
    const KEEP: MasternodeRegistrarUpdate = {operator: {kind: 'keep'}, voting: {kind: 'keep'}, payoutAddress: null}

    beforeEach(() => {
      list = [node(PRO_TX_HASH, {
        collateralTxid: 'cc'.repeat(32), collateralAddress: owned[0], payeeAddress: owned[2],
        ownerAddress: key('owner', 0), votingAddress: key('voting', 0), operatorPublicKey: key('operator', 0),
      })]
    })

    async function update(fields: Partial<MasternodeRegistrarUpdate>): Promise<{tx: Transaction; payload: ProUpRegTx}> {
      const result = await masternodes.updateRegistrar(walletId, PRO_TX_HASH, {...KEEP, ...fields}, PASSWORD)
      const tx = Transaction.fromHex(broadcast.at(-1)!)
      expect(result.txid).toBe(tx.hash())
      return {tx, payload: tx.extraPayload as ProUpRegTx}
    }

    it('restates the kept keys, signs with the owner key and leaves the collateral unspent', async () => {
      const {tx, payload} = await update({payoutAddress: owned[1]})

      expect(tx.type).toBe(3)
      expect(payload.version).toBe(2)
      expect(payload.proTxHash).toBe(PRO_TX_HASH)
      expect(payload.pubKeyOperator).toBe(key('operator', 0))
      expect(payload.keyIdVoting).toBe(keyIdOf(key('voting', 0)))
      expect(payload.scriptPayout.getAddress('testnet')).toBe(owned[1])
      expect(payloadSigner(payload)).toBe(key('owner', 0))
      expect(tx.inputs.map(input => input.txId)).toEqual(['aa'.repeat(32)])
      expect(payload.inputsHash).toBe(providerInputsHash(tx.inputs))
    })

    it('keeps the current payout when none is passed', async () => {
      const {payload} = await update({})
      expect(payload.scriptPayout.getAddress('testnet')).toBe(owned[2])
    })

    it('rotates to the lowest wallet keys no listed node carries', async () => {
      const {payload} = await update({operator: {kind: 'wallet'}, voting: {kind: 'wallet'}})
      expect(payload.pubKeyOperator).toBe(key('operator', 1))
      expect(payload.keyIdVoting).toBe(keyIdOf(key('voting', 1)))
    })

    it('refuses an external operator key another node carries', async () => {
      const taken = bytesToHex(bls12_381.G1.Point.BASE.multiply(7n).toBytes(true))
      list!.push(node('22'.repeat(32), {operatorPublicKey: taken}))
      await expect(masternodes.updateRegistrar(walletId, PRO_TX_HASH, {...KEEP, operator: {kind: 'external', publicKey: taken}}, PASSWORD))
        .rejects.toThrow('already uses this operator key')
      expect(broadcast).toEqual([])
    })

    it('refuses a node whose owner key the wallet does not derive', async () => {
      list = [node(PRO_TX_HASH, {votingAddress: key('voting', 0)})]
      await expect(masternodes.updateRegistrar(walletId, PRO_TX_HASH, KEEP, PASSWORD)).rejects.toThrow("owner key")
    })

    it('refuses a payout to the voting key', async () => {
      await expect(masternodes.updateRegistrar(walletId, PRO_TX_HASH, {...KEEP, payoutAddress: key('voting', 0)}, PASSWORD))
        .rejects.toThrow('may not pay the owner or voting key')
    })
  })
  describe('operator transactions', () => {
    const PRO_TX_HASH = '33'.repeat(32)
    const SERVICE: MasternodeServiceUpdate = {
      serviceAddress: '45.33.12.9:19999', operatorPayoutAddress: null, platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    }

    const operated = (fields: Partial<NetworkMasternode> = {}): NetworkMasternode => node(PRO_TX_HASH, {
      collateralTxid: 'cc'.repeat(32), collateralAddress: owned[0], operatorPublicKey: key('operator', 0), ...fields,
    })

    const signedByOperator = (payload: ProUpServTx | ProUpRevTx): boolean => {
      const {longSignatures} = bls12_381
      return longSignatures.verify(hexToBytes(payload.payloadSig), longSignatures.hash(payloadDigest(payload)), hexToBytes(key('operator', 0)))
    }

    const lastBroadcast = (): Transaction => Transaction.fromHex(broadcast.at(-1)!)

    it('restates a Regular service at v2, signed by the operator key', async () => {
      list = [operated()]
      await masternodes.updateService(walletId, PRO_TX_HASH, SERVICE, PASSWORD)
      const tx = lastBroadcast()
      const payload = tx.extraPayload as ProUpServTx

      expect(tx.type).toBe(2)
      expect([payload.version, payload.type, payload.proTxHash]).toEqual([2, 0, PRO_TX_HASH])
      expect([payload.ipAddress, payload.port]).toEqual(['45.33.12.9', 19999])
      expect(payload.scriptOperatorPayout.bytes()).toHaveLength(0)
      expect(signedByOperator(payload)).toBe(true)
      expect(tx.inputs.map(input => input.txId)).toEqual(['aa'.repeat(32)])
    })

    it('keeps an Evo service at v2 with its ports as fields until v24 is active', async () => {
      v24Active = false
      utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
      list = [operated({type: 'Evo'})]
      await masternodes.updateService(walletId, PRO_TX_HASH, {
        ...SERVICE, platformNodeId: EVO_FIELDS.platformNodeId, platformP2PPort: 36656, platformHttpPort: 1443,
      }, PASSWORD)
      const payload = lastBroadcast().extraPayload as ProUpServTx

      expect([payload.version, payload.platformP2PPort, payload.platformHTTPPort]).toEqual([2, 36656, 1443])
    })

    it('puts an Evo service and its platform endpoints in v3 netInfo once v24 is active', async () => {
      utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
      list = [operated({type: 'Evo'})]
      await masternodes.updateService(walletId, PRO_TX_HASH, {
        ...SERVICE, platformNodeId: EVO_FIELDS.platformNodeId, platformP2PPort: 36656, platformHttpPort: 1443,
      }, PASSWORD)
      const payload = lastBroadcast().extraPayload as ProUpServTx

      expect([payload.version, payload.type, payload.platformNodeID]).toEqual([3, 1, EVO_FIELDS.platformNodeId])
      expect(payload.netInfo!.getPrimary(1)).toBe('45.33.12.9:36656')
      expect(payload.netInfo!.getPrimary(2)).toBe('45.33.12.9:1443')
      expect(signedByOperator(payload)).toBe(true)
    })

    it('refuses a node whose operator key the wallet does not derive', async () => {
      list = [operated({operatorPublicKey: 'ff'.repeat(48), ownerAddress: key('owner', 0)})]
      await expect(masternodes.updateService(walletId, PRO_TX_HASH, SERVICE, PASSWORD)).rejects.toThrow('operator key')
      await expect(masternodes.revoke(walletId, PRO_TX_HASH, 'termination', PASSWORD)).rejects.toThrow('operator key')
      expect(broadcast).toEqual([])
    })

    it('revokes with the reason code, signed by the operator key', async () => {
      list = [operated()]
      await masternodes.revoke(walletId, PRO_TX_HASH, 'changeOfKeys', PASSWORD)
      const tx = lastBroadcast()
      const payload = tx.extraPayload as ProUpRevTx

      expect(tx.type).toBe(4)
      expect([payload.version, payload.proTxHash, payload.reason]).toEqual([2, PRO_TX_HASH, 3])
      expect(payload.inputsHash).toBe(providerInputsHash(tx.inputs))
      expect(signedByOperator(payload)).toBe(true)
    })

    // Core's BadPort: peers would fetch it and drop it without a word.
    it('refuses mainnet\'s port on testnet before unlocking anything', async () => {
      list = [operated()]
      await expect(masternodes.updateService(walletId, PRO_TX_HASH, {...SERVICE, serviceAddress: '1.2.3.4:9999'}, 'wrong password'))
        .rejects.toThrow("Port 9999 is mainnet's")
      expect(broadcast).toEqual([])
    })

    it('refuses to revoke a node the network list no longer carries', async () => {
      list = [operated()]
      gone.add(PRO_TX_HASH)
      await expect(masternodes.revoke(walletId, PRO_TX_HASH, 'termination', PASSWORD)).rejects.toThrow("network's masternode list does not carry")
      await expect(masternodes.updateService(walletId, PRO_TX_HASH, SERVICE, PASSWORD)).rejects.toThrow("network's masternode list does not carry")
      expect(broadcast).toEqual([])
    })

    it('refuses an unknown revocation reason', async () => {
      list = [operated()]
      await expect(masternodes.revoke(walletId, PRO_TX_HASH, 'bored' as never, PASSWORD)).rejects.toThrow('Unknown revocation reason')
    })
  })
})
