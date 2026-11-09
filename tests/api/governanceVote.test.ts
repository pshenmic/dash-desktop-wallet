import {beforeEach, describe, expect, it} from 'vitest'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {GovernanceService} from '../../src/main/src/services/core/GovernanceService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {Proposal} from '../../src/main/src/types/Governance'
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

  const service = (): GovernanceService => new GovernanceService(
    wired.walletDAO,
    {forWallet: () => ({getProposals: async () => proposals})} as unknown as WalletProviderFactory,
    {getMasternodes: async () => owned} as unknown as MasternodeService,
    {relayVote: async (vote: Uint8Array) => (relayed.push(vote), 3)} as unknown as WalletSyncService,
  )

  beforeEach(async () => {
    wired = await harness()
    relayed = []
    proposals = [proposal]
    owned = [node('aa'.repeat(32)), node('bb'.repeat(32), {votingKeyIndex: null, importedRoles: ['voting']})]
  })

  it.each(['mainnet', 'testnet'] as const)('signs a %s funding vote with the voting key the node carries', async (network: Network) => {
    const walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, network, PASSWORD)
    const keys = (await wired.masternodeKeyDAO.getKeys(walletId))!

    const results = await service().vote(walletId, PROPOSAL, 'no', ['aa'.repeat(32)], PASSWORD)

    expect(results).toEqual([{proTxHash: 'aa'.repeat(32), peers: 3}])
    expect(governanceVote(relayed[0], network)).toMatchObject({
      collateralTxid: 'aa'.repeat(32), collateralVout: 1, parentHash: PROPOSAL, outcome: 2, signal: 1,
      voter: masternodeKeyDeriver(keys, network, 'voting').derive(2).address,
    })
  })

  describe('refuses before unlocking', () => {
    let walletId: string
    beforeEach(async () => {
      walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)
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

    it('a wrong password', async () => {
      await expect(service().vote(walletId, PROPOSAL, 'yes', ['aa'.repeat(32)], 'wrong')).rejects.toThrow('Invalid wallet password')
      expect(relayed).toEqual([])
    })
  })
})
