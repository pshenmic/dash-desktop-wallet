import {HDKey} from '@scure/bip32'
import {WalletDAO} from '../../database/WalletDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {HD_VERSIONS} from '../../constants/addresses'
import {GOVERNANCE_UPDATE_MIN_SECONDS, POSE_BANNED_STATUS, VOTE_OUTCOME_CODE, VOTE_SIGNAL_FUNDING} from '../../constants/chain'
import {Proposal, ProposalTally, VoteOutcome, VoteResult} from '../../types/Governance'
import {governanceVote, lastVoteTime, requireVoteRequest, voteBytes, voteDigest} from '../../utils/governance'
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

  // A funding vote per node, signed with its voting key, refused on the checks
  // Core's own wallet runs before relaying. One it drops anyway comes back with
  // accepted 0.
  async vote(walletId: string, proposalHash: string, outcome: VoteOutcome, proTxHashes: string[], password: string): Promise<VoteResult[]> {
    requireVoteRequest(proposalHash, outcome, proTxHashes)
    const {network} = await requireWallet(this.walletDAO, walletId)
    const provider = this.providers.forWallet(walletId, network)
    const [proposals, votes] = await Promise.all([provider.getProposals(), provider.getProposalVotes(proposalHash)])
    if (proposals == null) throw new Error('The proposal list has not arrived yet')
    if (!proposals.some(({hash}) => hash === proposalHash)) throw new Error('Unknown proposal, or no superblock can pay it any more')

    const owned = await this.masternodeService.getMasternodes(walletId)
    if (owned == null) throw new Error('The masternode list has not arrived yet')
    const time = Math.floor(Date.now() / 1000)
    const nodes = proTxHashes.map(proTxHash => {
      const node = owned.find(candidate => candidate.proTxHash === proTxHash)
      if (node == null) throw new Error(`Masternode ${proTxHash} is not one of this wallet's`)
      if (node.status === POSE_BANNED_STATUS) throw new Error(`Masternode ${proTxHash} is PoSe-banned`)
      if (node.votingKeyIndex == null) throw new Error(`Masternode ${proTxHash} carries a voting key this wallet does not derive`)
      if (node.collateralTxid == null || node.collateralVout == null) throw new Error(`Masternode ${proTxHash} has no known collateral yet`)
      const last = votes == null ? null : lastVoteTime(votes, node)
      if (last != null && last > time - GOVERNANCE_UPDATE_MIN_SECONDS) {
        throw new Error(`Masternode ${proTxHash} voted on this proposal at ${new Date(last * 1000).toISOString()}; Core drops another vote within the hour`)
      }
      return {proTxHash, votingKeyIndex: node.votingKeyIndex, votingAddress: node.votingAddress, collateralTxid: node.collateralTxid, collateralVout: node.collateralVout}
    })

    const signed = await withUnlockedWallet(this.walletDAO, walletId, password, async ({seed}) => {
      const account = HDKey.fromMasterSeed(seed, HD_VERSIONS[network]).derive(masternodeAccountPath(network, 'voting'))
      return nodes.map(({proTxHash, votingKeyIndex, votingAddress, collateralTxid, collateralVout}) => {
        const unsigned = {collateralTxid, collateralVout, parentHash: proposalHash, outcome: VOTE_OUTCOME_CODE[outcome], signal: VOTE_SIGNAL_FUNDING, time}
        const bytes = voteBytes(unsigned, signHash(voteDigest(unsigned, network), account.deriveChild(votingKeyIndex).privateKey!))
        const signer = governanceVote(bytes, network).voter
        if (signer !== votingAddress) throw new Error(`Masternode ${proTxHash} lists voting key ${votingAddress}, not ${signer}`)
        return {proTxHash, bytes}
      })
    })

    log.info(`vote ${outcome} on ${proposalHash} with ${signed.length} masternode(s)`)
    return Promise.all(signed.map(async ({proTxHash, bytes}) => {
      const {peers, accepted} = await this.walletSyncService.relayVote(bytes)
      const line = `vote of ${proTxHash} on ${proposalHash}: ${peers} peer(s) asked for it, ${accepted} kept it`
      if (accepted === 0) log.warn(line)
      else log.info(line)
      return {proTxHash, peers, accepted}
    }))
  }
}
