import {beforeEach, describe, expect, it, vi} from 'vitest'
import {HDKey} from '@scure/bip32'
import {PrivateKey} from 'dash-core-sdk'
import {HD_VERSIONS} from '../../src/main/src/constants/addresses'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {ContestedResourceService} from '../../src/main/src/services/platform/ContestedResourceService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {ImportedMasternodeKey, Masternode} from '../../src/main/src/types/Masternode'
import {encryptImportedKey} from '../../src/main/src/utils/importedKeyEncryption'
import {masternodeAccountPath} from '../../src/main/src/utils/masternodeKeys'
import {withUnlockedWallet} from '../../src/main/src/utils/walletSeed'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const PRO_TX_HASH = 'ab'.repeat(32)
const CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
const RESOURCE = {
  contractId: CONTRACT_ID,
  documentTypeName: 'domain',
  indexName: 'parentNameAndLabel',
  indexValues: ['EgRkYXNo', 'EgNvd2w='],
}

type SentVote = {
  votingKey: Uint8Array
  proTxHash: string
  choice: unknown
  contractId: string
  documentTypeName: string
  indexName: string
  indexValues: string[]
}

describe('reading contested resources', () => {
  let service: ContestedResourceService
  let walletDAO: WalletDAO
  let request: ReturnType<typeof vi.fn>
  let walletId: string
  let node: Pick<Masternode, 'proTxHash' | 'votingKeyIndex' | 'votingAddress' | 'status'>
  let imported: ImportedMasternodeKey[]
  let secrets: Map<string, string>

  beforeEach(async () => {
    const wired = await harness()
    walletDAO = wired.walletDAO
    request = wired.request
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    node = {proTxHash: PRO_TX_HASH, votingKeyIndex: null, votingAddress: 'Xvoting', status: 'ENABLED'}
    imported = []
    secrets = new Map()
    const masternodes = {
      getMasternodes: async () => [node as Masternode],
      getImportedKeys: async () => imported,
      getImportedKeySecret: async (_walletId: string, _role: string, address: string) => secrets.get(address) ?? null,
    } as unknown as MasternodeService
    service = new ContestedResourceService(walletDAO, masternodes, {request} as unknown as PlatformWorkerService)
  })

  it('asks Platform for the polls still open on the wallet network', async () => {
    request.mockResolvedValue({resources: []})

    expect(await service.getContestedResources(walletId)).toEqual([])
    expect(request).toHaveBeenCalledWith('contestedResources', 'testnet', {})
  })

  it('signs an imported voting key and sends the listed resource unchanged', async () => {
    const key = PrivateKey.fromBytes(new Uint8Array(32).fill(12), 'testnet')
    node.votingAddress = key.getAddress()
    imported = [{role: 'voting', publicKey: node.votingAddress, hasPrivateKey: true}]
    secrets.set(node.votingAddress, await withUnlockedWallet(walletDAO, walletId, PASSWORD, async ({seed}) =>
      encryptImportedKey(key.toWIF(), seed)))

    let sent: SentVote | null = null
    request.mockImplementation(async (_kind: string, _network: string, payload: SentVote) => {
      sent = {...payload, votingKey: payload.votingKey.slice()}
      return {stHash: 'st-hash'}
    })

    const choice = {kind: 'towardsIdentity' as const, identifier: 'contender'}
    expect(await service.vote(walletId, PRO_TX_HASH, RESOURCE, choice, PASSWORD)).toEqual({stHash: 'st-hash'})
    expect(sent).toMatchObject({proTxHash: PRO_TX_HASH, ...RESOURCE, choice})
    expect(Buffer.from(sent!.votingKey)).toEqual(Buffer.from(key.bytes()))
  })

  it('refuses a PoSe-banned node', async () => {
    node.status = 'POSE_BANNED'
    node.votingKeyIndex = 0

    await expect(service.vote(walletId, PRO_TX_HASH, RESOURCE, {kind: 'lock'}, PASSWORD)).rejects.toThrow('PoSe-banned')
  })

  it('derives a wallet voting key at its key index', async () => {
    node.votingKeyIndex = 3
    let sent: SentVote | null = null
    request.mockImplementation(async (_kind: string, _network: string, payload: SentVote) => {
      sent = {...payload, votingKey: payload.votingKey.slice()}
      return {stHash: 'st-hash'}
    })

    await service.vote(walletId, PRO_TX_HASH, RESOURCE, {kind: 'lock'}, PASSWORD)

    const seed = await withUnlockedWallet(walletDAO, walletId, PASSWORD, async ({seed}) => seed.slice())
    const account = HDKey.fromMasterSeed(seed, HD_VERSIONS.testnet).derive(masternodeAccountPath('testnet', 'voting'))
    expect(Buffer.from(sent!.votingKey)).toEqual(Buffer.from(account.deriveChild(3).privateKey!))
  })
})