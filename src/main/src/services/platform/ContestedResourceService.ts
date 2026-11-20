import {HDKey} from '@scure/bip32'
import {PrivateKey} from 'dash-core-sdk'
import {HD_VERSIONS} from '../../constants/addresses'
import {POSE_BANNED_STATUS} from '../../constants/chain'
import {WalletDAO} from '../../database/WalletDAO'
import {MasternodeService} from '../core/MasternodeService'
import {ContestedResource, ContestedResourceVoteChoice, ContestedResourceVoteRequest} from '../../types/Governance'
import {decryptImportedKey} from '../../utils/importedKeyEncryption'
import {Logger} from '../../utils/logger'
import {votingKeyOf} from '../../utils/governance'
import {masternodeAccountPath} from '../../utils/masternodeKeys'
import {requireProTxHash} from '../../utils/providerTx'
import {requireWallet} from '../../utils/requireWallet'
import {withUnlockedWallet} from '../../utils/walletSeed'
import {PlatformWorkerService} from './PlatformWorkerService'

const log = new Logger('governance')

// Platform-side governance: reads the open vote polls and casts a masternode
// vote signed with its Core voting key. Core/GovernanceService cannot own this,
// because its layer never reaches into platform/.
export class ContestedResourceService {
  private walletDAO: WalletDAO
  private masternodes: MasternodeService
  private platform: PlatformWorkerService

  constructor(walletDAO: WalletDAO, masternodes: MasternodeService, platform: PlatformWorkerService) {
    this.walletDAO = walletDAO
    this.masternodes = masternodes
    this.platform = platform
  }

  // Every poll still open, across all contracts. Index values stay base64 of
  // their serialized form, which is what a vote transition carries.
  async getContestedResources(walletId: string): Promise<ContestedResource[]> {
    const {network} = await requireWallet(this.walletDAO, walletId)
    const {resources} = await this.platform.request('contestedResources', network, {})
    return resources
  }

  // The vote names the poll as it was listed, so the caller passes the
  // resource's index values unchanged.
  async vote(
    walletId: string,
    proTxHash: string,
    resource: ContestedResourceVoteRequest,
    choice: ContestedResourceVoteChoice,
    password: string,
  ): Promise<{stHash: string}> {
    requireProTxHash(proTxHash)
    const {network} = await requireWallet(this.walletDAO, walletId)
    const [owned, imported] = await Promise.all([
      this.masternodes.getMasternodes(walletId),
      this.masternodes.getImportedKeys(walletId),
    ])
    if (owned == null) throw new Error('The masternode list has not arrived yet')

    const signableImported = new Set(imported
      .filter(({role, hasPrivateKey}) => role === 'voting' && hasPrivateKey)
      .map(({publicKey}) => publicKey))
    const {node, key} = votingKeyOf(owned, proTxHash, signableImported)
    if (node.status === POSE_BANNED_STATUS) throw new Error(`Masternode ${proTxHash} is PoSe-banned`)
    const secret = key.votingKeyIndex == null
      ? await this.masternodes.getImportedKeySecret(walletId, 'voting', key.votingAddress)
      : null
    if (key.votingKeyIndex == null && secret == null) {
      throw new Error(`Masternode ${proTxHash} has no stored voting key to sign with`)
    }

    const votingKey = await withUnlockedWallet(this.walletDAO, walletId, password, async ({seed}) => {
      if (key.votingKeyIndex == null) return PrivateKey.fromWIF(decryptImportedKey(secret!, seed)).bytes()
      const account = HDKey.fromMasterSeed(seed, HD_VERSIONS[network]).derive(masternodeAccountPath(network, 'voting'))
      const derived = account.deriveChild(key.votingKeyIndex).privateKey
      if (derived == null) throw new Error(`Failed to derive the voting key of ${proTxHash}`)
      return derived
    })

    try {
      const {stHash} = await this.platform.request('contestedResourceVote', network, {
        votingKey,
        proTxHash,
        ...resource,
        choice,
      })
      const voted = choice.kind === 'towardsIdentity' ? choice.identifier : choice.kind
      log.info(`${proTxHash} voted ${voted} on ${resource.contractId}/${resource.documentTypeName}/${resource.indexName}`)
      return {stHash}
    } finally {
      votingKey.fill(0)
    }
  }
}