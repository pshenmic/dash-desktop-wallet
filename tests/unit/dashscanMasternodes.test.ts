import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {AddressDAO} from '../../src/main/src/database/AddressDAO'
import type {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import type {WalletDAO} from '../../src/main/src/database/WalletDAO'
import type {DashscanMasternode} from '../../src/main/src/types/Dashscan'

const mocks = vi.hoisted(() => ({fetch: vi.fn()}))

vi.mock('electron', () => ({net: {fetch: mocks.fetch}}))

const {DashscanWalletProvider} = await import('../../src/main/src/providers/DashscanWalletProvider')

const row: DashscanMasternode = {
  proTxHash: 'p', address: '1.2.3.4:19999', payee: 'ypayee1, ypayee2', status: 'ENABLED', type: 'Regular',
  posPenaltyScore: 0, lastPaidTime: '1970-01-01T00:00:00.000Z', lastPaidBlock: 0,
  ownerAddress: ['yowner1', 'yowner2'], votingAddress: 'yvoting', collateralAddress: 'ycollateral',
  pubKeyOperator: 'A73D', outpoint: `${'ab'.repeat(32)}-3`,
  platformNodeId: null, platformP2PPort: null, platformHTTPPort: null,
  shares: [
    {ownerAddress: 'yowner1', amountDuffs: 20000000000, refundAddress: 'yrefund1', rewardAddress: 'yreward1'},
    {ownerAddress: 'yowner2', amountDuffs: 30000000000, refundAddress: 'yrefund2', rewardAddress: 'yreward2'},
  ],
}

const provider = (): InstanceType<typeof DashscanWalletProvider> =>
  new DashscanWalletProvider('testnet', 'w1', {} as AddressDAO, {} as WalletDAO, {} as TransactionDAO)

const answer = (resultSet: DashscanMasternode[]): void => {
  mocks.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({resultSet, pagination: {page: 1, limit: 100, total: resultSet.length}}),
  } as Response)
}

describe('Dashscan masternode list', () => {
  beforeEach(() => mocks.fetch.mockReset())

  // The API matches owner_address against share owners; the wallet only has to
  // read the shares it gets back.
  it('searches share owners and maps the share table', async () => {
    answer([row])

    const found = await provider().getMasternodes('owner', ['yowner2'])

    expect(String(mocks.fetch.mock.calls[0][0])).toContain('owner_address=yowner2')
    expect(found.map(({proTxHash, isShared, ownerAddress}) => [proTxHash, isShared, ownerAddress]))
      .toEqual([['p', true, null]])
    expect(found[0].shares).toEqual([
      {ownerAddress: 'yowner1', amountDuffs: 20000000000n},
      {ownerAddress: 'yowner2', amountDuffs: 30000000000n},
    ])
  })
})
