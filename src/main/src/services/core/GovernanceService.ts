import {HDKey} from '@scure/bip32'
import {WalletDAO} from '../../database/WalletDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {HD_VERSIONS} from '../../constants/addresses'
import {VOTE_OUTCOME_CODE, VOTE_SIGNAL_FUNDING} from '../../constants/chain'
import {Proposal, ProposalTally, VoteOutcome, VoteResult} from '../../types/Governance'
import {requireVoteRequest, voteBytes, voteDigest} from '../../utils/governance'
import {masternodeAccountPath} from '../../utils/masternodeKeys'
import {signHash} from '../../utils/providerTx'
import {requireWallet} from '../../utils/requireWallet'
import {withUnlockedWallet} from '../../utils/walletSeed'
import {Logger} from '../../utils/logger'
import {MasternodeService} from './MasternodeService'
import {WalletSyncService} from './WalletSyncService'

const log = new Logger('governance')

export class GovernanceService {
  constructor(
    private readonly walletDAO: WalletDAO,
    private readonly providers: WalletProviderFactory,
    private readonly masternodeService: MasternodeService,
    private readonly walletSyncService: WalletSyncService,
  ) {}

  async getProposals(walletId: string): Promise<Proposal[] | null> {
    const {network} = await requireWallet(this.walletDAO, walletId)
    return this.providers.forWallet(walletId, network).getProposals()
  }

  // Null while the list, the votes or the masternodes they are checked against arrive.
  async getProposalTally(walletId: string, proposalHash: string): Promise<ProposalTally | null> {
    const {network} = await requireWallet(this.walletDAO, walletId)
    const provider = this.providers.forWallet(walletId, network)
    const proposals = await provider.getProposals()
    if (proposals == null) return null
    if (!proposals.some(({hash}) => hash === proposalHash)) throw new Error('Unknown proposal, or no superblock can pay it any more')
    return provider.getProposalTally(proposalHash)
  }

  // A funding vote per node, signed with its voting key. Core drops one from a
  // node that voted on this proposal within the hour, and says so to no one.
  async vote(walletId: string, proposalHash: string, outcome: VoteOutcome, proTxHashes: string[], password: string): Promise<VoteResult[]> {
    requireVoteRequest(proposalHash, outcome, proTxHashes)
    const {network} = await requireWallet(this.walletDAO, walletId)
    const proposals = await this.providers.forWallet(walletId, network).getProposals()
    if (proposals == null) throw new Error('The proposal list has not arrived yet')
    if (!proposals.some(({hash}) => hash === proposalHash)) throw new Error('Unknown proposal, or no superblock can pay it any more')

    const owned = await this.masternodeService.getMasternodes(walletId)
    if (owned == null) throw new Error('The masternode list has not arrived yet')
    const nodes = proTxHashes.map(proTxHash => {
      const node = owned.find(candidate => candidate.proTxHash === proTxHash)
      if (node == null) throw new Error(`Masternode ${proTxHash} is not one of this wallet's`)
      if (node.votingKeyIndex == null) throw new Error(`Masternode ${proTxHash} carries a voting key this wallet does not derive`)
      if (node.collateralTxid == null || node.collateralVout == null) throw new Error(`Masternode ${proTxHash} has no known collateral yet`)
      return {proTxHash, votingKeyIndex: node.votingKeyIndex, collateralTxid: node.collateralTxid, collateralVout: node.collateralVout}
    })

    const time = Math.floor(Date.now() / 1000)
    const votes = await withUnlockedWallet(this.walletDAO, walletId, password, async ({seed}) => {
      const account = HDKey.fromMasterSeed(seed, HD_VERSIONS[network]).derive(masternodeAccountPath(network, 'voting'))
      return nodes.map(({proTxHash, votingKeyIndex, collateralTxid, collateralVout}) => {
        const unsigned = {collateralTxid, collateralVout, parentHash: proposalHash, outcome: VOTE_OUTCOME_CODE[outcome], signal: VOTE_SIGNAL_FUNDING, time}
        const key = account.deriveChild(votingKeyIndex).privateKey!
        return {proTxHash, bytes: voteBytes(unsigned, signHash(voteDigest(unsigned, network), key))}
      })
    })

    log.info(`vote ${outcome} on ${proposalHash} with ${votes.length} masternode(s)`)
    return Promise.all(votes.map(async ({proTxHash, bytes}) => {
      const peers = await this.walletSyncService.relayVote(bytes)
      log.info(`vote of ${proTxHash} on ${proposalHash}: ${peers} peer(s) asked for it`)
      return {proTxHash, peers}
    }))
  }
}
