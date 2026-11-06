import {describe, expect, it} from 'vitest'
import {P2PWalletProvider} from '../../src/main/src/providers/P2PWalletProvider'
import type {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import type {AddressDAO} from '../../src/main/src/database/AddressDAO'
import type {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import type {CorePrevOutService} from '../../src/main/src/services/core/CorePrevOutService'
import type {NetworkMasternode} from '../../src/main/src/types/Masternode'

function node(proTxHash: string, fields: Partial<NetworkMasternode> = {}): NetworkMasternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: null,
    collateralTxid: 'c'.repeat(64), collateralVout: 0, collateralAddress: null,
    serviceAddress: '1.2.3.4:19999', payeeAddress: null, ownerAddress: 'yowner', votingAddress: 'yvoting',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: null, lastPaidTime: null, registeredHeight: 10, ...fields,
  }
}

const OURS = 'yeRZBWYfeNE4yVUHV4ZLs83Ppn9aMRH57A'

const provider = (list: NetworkMasternode[] | null): P2PWalletProvider => {
  const walletSyncService = {getMasternodeList: () => list, getStatus: () => ({tipHeight: 100})} as unknown as WalletSyncService
  const addressDAO = {getAddressesByWalletId: async () => ({receiving: [{address: OURS}], change: []})} as unknown as AddressDAO
  const transactionDAO = {
    getUtxosByAddresses: async () => [{txid: 'c'.repeat(64), vout: 0, satoshis: '100000000000', address: OURS, height: 5, blockTime: 0}],
  } as unknown as TransactionDAO
  return new P2PWalletProvider(transactionDAO, 'w1', walletSyncService, addressDAO, {} as CorePrevOutService, 'testnet')
}

describe('masternodes from the p2p list', () => {
  it('has no answer before the first proven list arrives', async () => {
    expect(await provider(null).getMasternodes('voting', ['yvoting'])).toBeNull()
  })

  it('answers the same OR-of-values search the Dashscan filters run', async () => {
    const list = [node('a'), node('b', {ownerAddress: 'yother', votingAddress: 'ynone'})]
    expect((await provider(list).getMasternodes('owner', ['yowner', 'yother']))!.map(({proTxHash}) => proTxHash)).toEqual(['a', 'b'])
    expect((await provider(list).getMasternodes('voting', ['yvoting']))!.map(({proTxHash}) => proTxHash)).toEqual(['a'])
  })

  // A collateral made outside the ProRegTx has no address in the index.
  it('finds our collateral by the coin it spends from', async () => {
    const found = await provider([node('a'), node('b', {collateralTxid: 'd'.repeat(64)})]).getMasternodes('collateral', [OURS])
    expect(found!.map(({proTxHash, collateralAddress}) => [proTxHash, collateralAddress])).toEqual([['a', OURS]])
  })
})
