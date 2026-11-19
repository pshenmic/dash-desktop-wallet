import {beforeEach, describe, expect, it} from 'vitest'
import {hexToBytes} from '@noble/hashes/utils.js'
import {bls, Output, recoverHashSigner, recoverMessageSigner, Script, Transaction, utils as sdkUtils} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {ProUpRegTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRegTx.js'
import {ProUpRevTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRevTx.js'
import {ProUpServTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpServTx.js'
import {bls12_381} from '@noble/curves/bls12-381.js'
import {bytesToHex} from '@noble/hashes/utils.js'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {ADDRESS_PREFIX} from '../../src/main/src/constants/addresses'
import {MasternodeDAO} from '../../src/main/src/database/MasternodeDAO'
import {MasternodeIdentityDAO} from '../../src/main/src/database/MasternodeIdentityDAO'
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
import {masternodeIdentityIds} from '../../src/main/src/utils/masternodeIdentities'
import {nodeKeyValues} from '../../src/main/src/utils/masternodes'
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
  ({address, satoshis, txId, vOut: 0, script: p2pkhScript(address), height: 1_000_000, timestamp: null, confirmations: 20, isLocked: false})

function node(proTxHash: string, fields: Partial<NetworkMasternode>): NetworkMasternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: 0,
    collateralTxid: 'ee'.repeat(32), collateralVout: 0, collateralAddress: 'ynobody',
    serviceAddress: '1.2.3.4:19999', payeeAddress: 'ypayee', ownerAddress: 'ynobody', votingAddress: 'ynobody',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: 0, lastPaidTime: 0, registeredHeight: null, isShared: false, shares: [], ...fields,
  }
}

const EVO_FIELDS: Partial<MasternodeRegistration> & {platformNodeId: string} =
  {type: 'Evo', platformNodeId: '5b6ddd9532c5863b8bb113ef92d77f77b66f859b', platformP2PPort: 36656, platformHttpPort: 1443}

function payloadSigner(payload: ProRegTX | ProUpRegTx): string {
  const signature = hexToBytes(payload.payloadSig)
  const signer = payload instanceof ProRegTX
    ? recoverMessageSigner(payload.signString('testnet'), signature)
    : recoverHashSigner(payload.payloadHash(), signature)
  return signer.getAddress(sdkUtils.networkValueToEnumValue('testnet'))
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
  let masternodeIdentities: MasternodeIdentityDAO

  const key = (chain: MasternodeKeyChain, index: number): string =>
    masternodeKeyDeriver(keys, 'testnet', chain).derive(index).address

  const registration = (fields: Partial<MasternodeRegistration> = {}): MasternodeRegistration => ({
    type: 'Regular',
    collateral: {txid: 'cc'.repeat(32), vout: 0},
    serviceAddress: '45.33.12.7:19999',
    payoutAddress: owned[2],
    operatorReward: 0,
    ownerAddress: null,
    votingAddress: null,
    operatorPublicKey: null,
    platformNodeId: null,
    platformP2PPort: null,
    platformHttpPort: null,
    ...fields,
  })

  async function register(fields: Partial<MasternodeRegistration> = {}): Promise<{tx: Transaction; payload: ProRegTX; fee: bigint}> {
    const preview = await masternodes.previewRegistration(walletId, registration(fields))
    const result = await masternodes.signAndBroadcastRegistration(walletId, preview.unsignedHex, PASSWORD)
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
        list?.filter(entry => nodeKeyValues(filter, entry).some(key => values.includes(key))) ?? null,
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
      wired.walletDAO, wired.masternodeKeyDAO, new MasternodeDAO(wired.knex), new MasternodeIdentityDAO(wired.knex),
      {forWallet: () => provider} as unknown as WalletProviderFactory,
      wired.addressDAO, new CoreTransactionService(), walletSync, Preferences.default(),
    )
    masternodeIdentities = new MasternodeIdentityDAO(wired.knex)
  })

  it('references the collateral, signs with its key and pays the fee from other coins', async () => {
    const {tx, payload, fee} = await register()

    expect(payload.version).toBe(2)
    expect(payload.type).toBe(0)
    expect(payload.collateralOutpoint).toMatchObject({txId: 'cc'.repeat(32), vOut: 0})
    expect(tx.inputs.map(input => input.txId)).toEqual(['aa'.repeat(32)])
    expect(payload.inputsHash).toBe(tx.providerInputsHash())
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

  it('registers with the owner, voting and operator keys the caller supplies', async () => {
    const {payload} = await register({
      ownerAddress: key('owner', 7), votingAddress: key('voting', 7), operatorPublicKey: key('operator', 7).toUpperCase(),
    })

    expect(payload.getOwnerAddress('testnet')).toBe(key('owner', 7))
    expect(payload.getVotingAddress('testnet')).toBe(key('voting', 7))
    expect(payload.pubKeyOperator).toBe(key('operator', 7))
  })

  it('refuses a P2SH owner or voting key, a malformed operator key and one another node carries', async () => {
    const p2sh = Base58Check.encode(new Uint8Array([ADDRESS_PREFIX.testnet.p2sh, ...sdkUtils.addressToPublicKeyHash(owned[1])]))
    await expect(register({ownerAddress: p2sh})).rejects.toThrow('owner key must be a P2PKH address')
    await expect(register({votingAddress: p2sh})).rejects.toThrow('voting key must be a P2PKH address')
    await expect(register({operatorPublicKey: 'ff'.repeat(48)})).rejects.toThrow('Not a BLS public key')

    const taken = key('operator', 3)
    list = [node('22'.repeat(32), {operatorPublicKey: taken})]
    await expect(register({operatorPublicKey: taken})).rejects.toThrow('already uses this operator key')
    expect(broadcast).toEqual([])
  })

  it('carries the platform node id and ports an Evo is given', async () => {
    utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
    const {payload} = await register({type: 'Evo', platformNodeId: EVO_FIELDS.platformNodeId.toUpperCase(), platformP2PPort: 36656, platformHttpPort: 1443})

    expect(payload.type).toBe(1)
    expect(payload.platformNodeID).toBe(EVO_FIELDS.platformNodeId)
    expect([payload.platformP2PPort, payload.platformHTTPPort]).toEqual([36656, 1443])
  })

  it('stores the owner and voter identities Platform creates for an Evo', async () => {
    utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
    const {tx} = await register({type: 'Evo', ...EVO_FIELDS})

    expect(await masternodeIdentities.getByWalletId(walletId)).toEqual(
      masternodeIdentityIds(tx.hash(), key('voting', 0)).map(({role, identifier}) => ({
        walletId, proTxHash: tx.hash(), role, identifier,
      })),
    )
  })

  it('stores no identities for a Regular registration', async () => {
    await register()
    expect(await masternodeIdentities.getByWalletId(walletId)).toEqual([])
  })

  // A node is in no list before it mines, so discovery has nothing to own yet.
  it('keeps a just-registered identity through the next discovery', async () => {
    utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
    await register({type: 'Evo', ...EVO_FIELDS})

    list = []
    await masternodes.discover(walletId)

    expect(await masternodeIdentities.getByWalletId(walletId)).toHaveLength(2)
  })

  // Core reads a collateral from the UTXO set only, so peers drop the tx silently.
  it('refuses a collateral still in the mempool', async () => {
    utxos[0] = {...utxo(owned[0], 1_000n * DASH, 'cc'.repeat(32)), height: 0, confirmations: 0}
    await expect(register()).rejects.toThrow('needs a confirmation')
    expect(broadcast).toEqual([])
  })

  it('refuses a collateral of the wrong amount for the type', async () => {
    await expect(register(EVO_FIELDS)).rejects.toThrow('exactly 4000 DASH')
    expect(broadcast).toEqual([])
  })

  it('refuses an Evo without its platform node id', async () => {
    utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
    await expect(register({...EVO_FIELDS, platformNodeId: null})).rejects.toThrow('platform node id')
  })

  it('refuses a coin that already backs a masternode', async () => {
    list = [node('22'.repeat(32), {collateralTxid: 'cc'.repeat(32), collateralVout: 0, collateralAddress: owned[0]})]
    await expect(register()).rejects.toThrow('already a masternode collateral')
  })

  it('refuses before any list has arrived to tell which keys are free', async () => {
    list = null
    await expect(register()).rejects.toThrow('has not arrived')
  })

  describe('previewRegistration', () => {
    it('resolves the payload and the fee without a password or a broadcast', async () => {
      const preview = await masternodes.previewRegistration(walletId, registration())

      expect(preview).toMatchObject({
        type: 'Regular',
        collateral: {txid: 'cc'.repeat(32), vout: 0},
        ownerAddress: key('owner', 0),
        votingAddress: key('voting', 0),
        operatorPublicKey: key('operator', 0),
        serviceAddress: '45.33.12.7:19999',
        payoutAddress: owned[2],
        operatorReward: 0,
        platformNodeId: null,
        platformP2PPort: null,
        platformHttpPort: null,
        ownerKeyIndex: 0,
        votingKeyIndex: 0,
        operatorKeyIndex: 0,
      })
      expect(preview.feeDuffs).toBeGreaterThan(0n)
      expect(preview.inputs.map(({address, reference}) => [address, reference]))
        .toEqual([[owned[1], `${'aa'.repeat(32)}:0`]])
      expect(preview.outputs).toHaveLength(1)
      expect(preview.outputs[0]).toMatchObject({role: 'change', unit: 'duffs', amount: DASH - preview.feeDuffs})
      expect(broadcast).toEqual([])

      const tx = Transaction.fromHex(preview.unsignedHex)
      const payload = tx.extraPayload as ProRegTX
      expect(tx.type).toBe(1)
      expect(payload.getOwnerAddress('testnet')).toBe(key('owner', 0))
      expect(payload.getVotingAddress('testnet')).toBe(key('voting', 0))
      expect(payload.pubKeyOperator).toBe(key('operator', 0))
      expect(payload.getPayoutAddress('testnet')).toBe(owned[2])
      expect(payload.payloadSig).toBe('')
    })

    it('prices the transaction register broadcasts', async () => {
      const preview = await masternodes.previewRegistration(walletId, registration())
      const {tx, payload, fee} = await register()

      expect(preview.feeDuffs).toBe(fee)
      expect(preview.inputs.map(({reference}) => reference)).toEqual(tx.inputs.map(({txId, vOut}) => `${txId}:${vOut}`))
      const previewed = (Transaction.fromHex(preview.unsignedHex).extraPayload as ProRegTX)
      expect(previewed.payloadHash()).toEqual(payload.payloadHash())
    })

    it('previews supplied keys without a wallet index', async () => {
      const preview = await masternodes.previewRegistration(walletId, registration({
        ownerAddress: key('owner', 7), votingAddress: key('voting', 7), operatorPublicKey: key('operator', 7),
      }))

      expect(preview).toMatchObject({
        ownerAddress: key('owner', 7),
        votingAddress: key('voting', 7),
        operatorPublicKey: key('operator', 7),
        ownerKeyIndex: null,
        votingKeyIndex: null,
        operatorKeyIndex: null,
      })
    })

    it('reports the fields the payload carries, not the request spelling', async () => {
      utxos[0] = utxo(owned[0], 4_000n * DASH, 'cc'.repeat(32))
      const preview = await masternodes.previewRegistration(walletId, registration({
        ...EVO_FIELDS, platformNodeId: EVO_FIELDS.platformNodeId.toUpperCase(),
      }))

      expect(preview.platformNodeId).toBe(EVO_FIELDS.platformNodeId)
    })

    // The sign step refuses an unconfirmed input, so selecting one would return
    // a transaction the wallet can never broadcast.
    it('leaves an unconfirmed coin out of the fee selection', async () => {
      utxos[1] = {...utxos[1], height: 0, confirmations: 0}

      await expect(masternodes.previewRegistration(walletId, registration())).rejects.toThrow('No spendable funds')
    })
  })

  describe('signAndBroadcastRegistration', () => {
    it('signs the bytes the preview returned', async () => {
      const preview = await masternodes.previewRegistration(walletId, registration())
      const result = await masternodes.signAndBroadcastRegistration(walletId, preview.unsignedHex, PASSWORD)
      const tx = Transaction.fromHex(broadcast.at(-1)!)

      expect(result.proTxHash).toBe(tx.hash())
      expect(result.fee).toBe(preview.feeDuffs)
      expect(payloadSigner(tx.extraPayload as ProRegTX)).toBe(owned[0])
    })

    it('refuses bytes that no longer match what the wallet would build', async () => {
      const preview = await masternodes.previewRegistration(walletId, registration())
      const forged = Transaction.fromHex(preview.unsignedHex)
      ;(forged.extraPayload as ProRegTX).inputsHash = '00'.repeat(32)

      await expect(masternodes.signAndBroadcastRegistration(walletId, forged.hex(), PASSWORD))
        .rejects.toThrow('does not match')
      expect(broadcast).toEqual([])
    })

    it('refuses a second output or one that does not pay this wallet', async () => {
      const preview = await masternodes.previewRegistration(walletId, registration())
      const stranger = sdkUtils.publicKeyHashToAddress(new Uint8Array(20).fill(7), 'testnet')

      const extra = Transaction.fromHex(preview.unsignedHex)
      const output = new Output(DASH / 2n)
      output.generateP2PKH(stranger)
      extra.addOutput(output)
      await expect(masternodes.signAndBroadcastRegistration(walletId, extra.hex(), PASSWORD))
        .rejects.toThrow('pays its change and nothing else')

      const swapped = Transaction.fromHex(preview.unsignedHex)
      swapped.outputs[0].script = p2pkhScript(stranger)
      await expect(masternodes.signAndBroadcastRegistration(walletId, swapped.hex(), PASSWORD))
        .rejects.toThrow("not this wallet's")

      const burned = Transaction.fromHex(preview.unsignedHex)
      burned.outputs = []
      await expect(masternodes.signAndBroadcastRegistration(walletId, burned.hex(), PASSWORD))
        .rejects.toThrow('fee does not match')
      expect(broadcast).toEqual([])
    })

    it('refuses a transaction that is not a registration', async () => {
      await expect(masternodes.signAndBroadcastRegistration(walletId, 'not hex', PASSWORD)).rejects.toThrow('Not a transaction')
      await expect(masternodes.signAndBroadcastRegistration(walletId, new Transaction().hex(), PASSWORD)).rejects.toThrow('Not a registration')
    })
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
      expect(payload.inputsHash).toBe(tx.providerInputsHash())
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

    it('refuses a shared node, whose updates need every share owner', async () => {
      list = [node(PRO_TX_HASH, {ownerAddress: null, isShared: true, shares: [
        {ownerAddress: key('owner', 0), amountDuffs: 20000000000n},
        {ownerAddress: 'Xother', amountDuffs: 80000000000n},
      ]})]
      await expect(masternodes.updateRegistrar(walletId, PRO_TX_HASH, KEEP, PASSWORD)).rejects.toThrow('every share owner')
      expect(broadcast).toEqual([])
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

    const signedByOperator = (payload: ProUpServTx | ProUpRevTx): boolean =>
      bls.blsVerify(hexToBytes(payload.payloadSig), payload.payloadHash(), hexToBytes(key('operator', 0)))

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

    // ProUpServTx is signed by the operator key alone, so a shared node's
    // service update is the same transaction a solo node's is.
    it('updates a shared node\'s service with its operator key', async () => {
      list = [operated({ownerAddress: null, isShared: true, shares: [
        {ownerAddress: 'Xother1', amountDuffs: 60000000000n},
        {ownerAddress: 'Xother2', amountDuffs: 40000000000n},
      ]})]
      await masternodes.updateService(walletId, PRO_TX_HASH, SERVICE, PASSWORD)
      const tx = lastBroadcast()
      const payload = tx.extraPayload as ProUpServTx

      expect(tx.type).toBe(2)
      expect([payload.version, payload.type, payload.proTxHash]).toEqual([2, 0, PRO_TX_HASH])
      expect([payload.ipAddress, payload.port]).toEqual(['45.33.12.9', 19999])
      expect(signedByOperator(payload)).toBe(true)
    })

    it('refuses to revoke a shared node, which every share owner would have to restore', async () => {
      list = [operated({ownerAddress: null, isShared: true, shares: [
        {ownerAddress: 'Xother1', amountDuffs: 60000000000n},
        {ownerAddress: 'Xother2', amountDuffs: 40000000000n},
      ]})]
      await expect(masternodes.revoke(walletId, PRO_TX_HASH, 'termination', PASSWORD)).rejects.toThrow('every share owner')
      expect(broadcast).toEqual([])
    })

    it('revokes with the reason code, signed by the operator key', async () => {
      list = [operated()]
      await masternodes.revoke(walletId, PRO_TX_HASH, 'changeOfKeys', PASSWORD)
      const tx = lastBroadcast()
      const payload = tx.extraPayload as ProUpRevTx

      expect(tx.type).toBe(4)
      expect([payload.version, payload.proTxHash, payload.reason]).toEqual([2, PRO_TX_HASH, 3])
      expect(payload.inputsHash).toBe(tx.providerInputsHash())
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
