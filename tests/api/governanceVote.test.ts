import {beforeEach, describe, expect, it} from 'vitest'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {GovernanceService} from '../../src/main/src/services/core/GovernanceService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {GovernanceVote, Proposal} from '../../src/main/src/types/Governance'
import {Masternode} from '../../src/main/src/types/Masternode'
import {Network} from '../../src/main/src/types/Network'
import {governanceVote} from '../../src/main/src/utils/governance'
import {masternodeKeyDeriver} from '../../src/main/src/utils/masternodeKeys'
import {harness, Harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const PROPOSAL = 'a5465cdb6caf234cc9b8b776b1e3b60f319367504527e80a669bf41811419901'

const proposal: Proposal = {
  hash: PROPOSAL, name: 'p', url: '', paymentAddress: 'Xpay', paymentDuffs: 1n,
  startEpoch: 0, endEpoch: 0, createdAt: 0, collateralHash: '00'.repeat(32),
}

function node(proTxHash: string, fields: Partial<Masternode> = {}): Masternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: 0, collateralTxid: proTxHash, collateralVout: 1,
    collateralAddress: null, serviceAddress: null, payeeAddress: null, ownerAddress: null, votingAddress: 'Xvoting',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: null, lastPaidTime: null, registeredHeight: null,
    ownerKeyIndex: null, votingKeyIndex: 2, operatorKeyIndex: null, importedRoles: [], ...fields,
  }
}

describe('GovernanceService.vote', () => {
  let wired: Harness
  let relayed: Uint8Array[]
  let proposals: Proposal[] | null
  let owned: Masternode[] | null
  let votes: GovernanceVote[] | null
  let refreshed: Array<string | undefined>

  const service = (): GovernanceService => new GovernanceService(
    wired.walletDAO,
    {forWallet: () => ({
      getProposals: async () => proposals,
      getProposalVotes: async () => votes,
      refreshGovernance: async (hash?: string) => { refreshed.push(hash) },
    })} as unknown as WalletProviderFactory,
    {getMasternodes: async () => owned} as unknown as MasternodeService,
    {relayVote: async (vote: Uint8Array) => (relayed.push(vote), {peers: 3, accepted: 2})} as unknown as WalletSyncService,
  )

  beforeEach(async () => {
    wired = await harness()
    relayed = []
    refreshed = []
    proposals = [proposal]
    votes = null
    owned = null
  })

  // The node votes with key #2 of the wallet's voting chain, as the list states it.
  async function wallet(network: Network): Promise<string> {
    const walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, network, PASSWORD)
    const keys = (await wired.masternodeKeyDAO.getKeys(walletId))!
    const votingAddress = masternodeKeyDeriver(keys, network, 'voting').derive(2).address
    owned = [node('aa'.repeat(32), {votingAddress}), node('bb'.repeat(32), {votingKeyIndex: null, importedRoles: ['voting']})]
    return walletId
  }

  it.each(['mainnet', 'testnet'] as const)('signs a %s funding vote with the voting key the node carries', async (network: Network) => {
    const walletId = await wallet(network)

    const results = await service().vote(walletId, PROPOSAL, 'no', ['aa'.repeat(32)], PASSWORD)

    expect(results).toEqual([{proTxHash: 'aa'.repeat(32), peers: 3, accepted: 2}])
    expect(governanceVote(relayed[0], network)).toMatchObject({
      collateralTxid: 'aa'.repeat(32), collateralVout: 1, parentHash: PROPOSAL, outcome: 2, signal: 1, voter: owned![0].votingAddress,
    })
  })

  // Reads answer what a refresh brought and fetch nothing themselves.
  it('fetches on refresh alone: the list, and a proposal\'s votes when named', async () => {
    const walletId = await wallet('mainnet')
    await service().getProposals(walletId)
    await service().getProposalTally(walletId, PROPOSAL).catch(() => undefined)
    expect(refreshed).toEqual([])

    await service().refresh(walletId)
    await service().refresh(walletId, PROPOSAL)
    expect(refreshed).toEqual([undefined, PROPOSAL])
    await expect(service().refresh(walletId, 'nope')).rejects.toThrow('Not a proposal hash')
  })

  describe('refuses before unlocking', () => {
    let walletId: string
    beforeEach(async () => {
      walletId = await wallet('mainnet')
    })

    it('a proposal no superblock can pay any more, or one not listed', async () => {
      proposals = []
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32)], PASSWORD)).rejects.toThrow('no superblock can pay it')
    })

    it('while the proposal list has not arrived', async () => {
      proposals = null
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32)], PASSWORD)).rejects.toThrow('has not arrived')
    })

    it('a node that is not the wallet’s, or whose voting key it does not derive', async () => {
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['cc'.repeat(32)], PASSWORD)).rejects.toThrow("not one of this wallet's")
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['bb'.repeat(32)], PASSWORD)).rejects.toThrow('does not derive')
    })

    it('an outcome Core has no code for, an empty or repeated node list', async () => {
      await expect(service().vote(walletId, PROPOSAL, 'maybe' as never, ['aa'.repeat(32)], PASSWORD)).rejects.toThrow('Unknown vote outcome')
      await expect(service().vote(walletId, PROPOSAL, 'yes', [], PASSWORD)).rejects.toThrow('at least one')
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32), 'aa'.repeat(32)], PASSWORD)).rejects.toThrow('twice')
    })

    it('a PoSe-banned node, as Core’s wallet does', async () => {
      owned![0].status = 'POSE_BANNED'
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32)], PASSWORD)).rejects.toThrow('PoSe-banned')
    })

    // Core drops it without a word; its wallet refuses with "voting too often".
    it('a node that voted on the proposal within the hour', async () => {
      const voted = {hash: 'h', collateralTxid: 'aa'.repeat(32), collateralVout: 1, parentHash: PROPOSAL, outcome: 1, signal: 1, voter: owned![0].votingAddress}
      votes = [{...voted, time: Math.floor(Date.now() / 1000) - 3_000}]
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32)], PASSWORD)).rejects.toThrow('within the hour')

      votes = [{...voted, time: Math.floor(Date.now() / 1000) - 3_700}, {...voted, time: Math.floor(Date.now() / 1000) - 60, voter: 'Xold'}]
      expect(await service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32)], PASSWORD)).toHaveLength(1)
    })

    it('a vote its key would sign for another voting key than the list states', async () => {
      owned![0].votingAddress = 'Xsomeone'
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32)], PASSWORD)).rejects.toThrow('lists voting key Xsomeone')
      expect(relayed).toEqual([])
    })

    it('a wrong password', async () => {
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32)], 'wrong')).rejects.toThrow('Invalid wallet password')
      expect(relayed).toEqual([])
    })
  })
})
