import {describe, it, expect} from 'vitest'
import {MnListDiff, MnType, SimplifiedMNListEntry} from 'dash-core-p2p'
import {Script, Transaction, TransactionType, utils as sdkUtils} from 'dash-core-sdk'
import {ProUpRegTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRegTx.js'
import {
  evonodeDapiUrls,
  listedMasternode,
  payoutUpdate,
  providerRegistration,
} from '../../src/main/p2p/utils/masternodeList'
import {wireToDisplayHex} from '../../src/main/p2p/utils/byteOrder'
import {hashHeaderRaw} from '../../src/main/p2p/utils/pow'

const entry = (n: number, nType: number, isValid: boolean, host: string, platformHTTPPort?: number): SimplifiedMNListEntry => ({
  nVersion: 2,
  proRegTxHash: n.toString(16).padStart(64, '0'),
  confirmedHash: '00'.repeat(32),
  service: new Uint8Array(18),
  address: {networkId: 1, addr: new Uint8Array(4), host, port: 9999},
  pubKeyOperator: '00'.repeat(48),
  keyIDVoting: '00'.repeat(20),
  isValid,
  nType,
  platformHTTPPort,
  platformNodeID: nType === MnType.Evo ? '00'.repeat(20) : undefined,
})

// A full list whose coinbase commits to `committed`, or to the list itself.
function diffOf(mnList: SimplifiedMNListEntry[], committed = MnListDiff.calcMerkleRootMNList(mnList)): MnListDiff {
  const diff = Object.assign(new MnListDiff(), {mnList})
  Object.defineProperty(diff, 'merkleRootMNList', {value: committed})
  return diff
}

describe('evonode DAPI urls', () => {
  it('hands on valid evonodes only', () => {
    const urls = evonodeDapiUrls(diffOf([
      entry(1, MnType.Evo, true, '68.67.122.23', 1443),
      entry(2, MnType.Evo, false, '68.67.122.24', 1443),
      entry(3, MnType.Regular, true, '68.67.122.25'),
    ]))
    expect(urls).toEqual(['https://68.67.122.23:1443'])
  })

  it('brackets an IPv6 host and drops a repeated url', () => {
    const urls = evonodeDapiUrls(diffOf([
      entry(1, MnType.Evo, true, '2001:db8::1', 443),
      entry(2, MnType.Evo, true, '2001:db8::1', 443),
    ]))
    expect(urls).toEqual(['https://[2001:db8::1]:443'])
  })

  it('refuses a list its coinbase does not commit to', () => {
    expect(evonodeDapiUrls(diffOf([entry(1, MnType.Evo, true, '68.67.122.23', 1443)], 'ff'.repeat(32)))).toBeNull()
  })
})

// Testnet ProRegTxs as mined, with what Dashscan reports for each node.
const INTERNAL = '99ae7010c1c4ef77658ad86abda661828e0933c503b0b5e9941139dded393c80'
const INTERNAL_TX = '030001000105cc2df608821afc9b57625e4737d61c39e039e0c3a91689a28e2948d282e290010000006a473044022044c860c0bb1a59144749205fea2b3869c12f508dd4201333470c9433ca35a949022057102ad2c4bf1dfc4f525eb8a14a4c1f640fbe57f3a0668d973db3d76dc2a1d0012103c503ba2aa1b3caf3738199be5b13d3d364496f3823e8edb914276496ef86e372feffffff02969d0e00000000001976a914fa5aadd517848287621bb0cc0046e3a7e1812ba488ac00e876481700000017a9146322236e88a915728e72f6d7a7c7fc1129ebeb998700000000d102000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000ffff592803814e1f05d561177987cb0cab926ce78e4d7bdc4ce461be844e036dd08f2a973014023016dfb5fe4d533be55aeb81da956becd312345aeca4a41b168a51b87ef5e42c3c6892fce06bbc79395663389c2864b7e423e111b9d73b338100001976a914c623e2d926af5eb52dcc2b931993d3e52714511888ac2b00c9bc88c98677be079e57e7d346d0638fcd630cd5b0e47754fe0b1a0d454f00'
const EVO = '8e11eb784883d3dc9d0d74a74633f067dc61c408dfdee49b8f93bb161f2916c0'
const EVO_TX = '03000100016ebca7f8c2852d1034b37fa4e464d6710dd952acad4f252752d9fb703bed2928200000006a47304402202ec687b9f4e8f8047690521d18196644b33b8310f64f854c0b05d2a2d90010380220120fefc98587fc0fe66a89727b1b9bb3880f7fd382148bd35be25e09d2287f760121020a25e4e16b91a17a5ef5627755d9cb81f1cd6d84026262f94ce0f4a4f2cb829dfeffffff01307af505000000001976a914f53e3ff160dab7ec3cc2a6b0afa6dd8d36e3879488ac00000000fd2a01020001000000593aaec65459ca9a97bd34b2657c8201ae83952d062715ba3af0d4255e54e86c2000000000000000000000000000ffff34599a304e1f0063eb51fcfd121e6c3eae23b90b26cd1100217b8160877a911d8bb7d1e75e2320e98cc3233c1f6972cb642424bfcec7c182c56d2c0ebb59e45f788f4d5dbfa2ebff3e3a0063eb51fcfd121e6c3eae23b90b26cd1100217b00001976a914c69a0bda7daaae481be8def95e5f347a1d00a4b488acddb1df193e8da1e028e7985d096ac11e8f38e5f85df16508487ff4ec434af2ae357cb7f558f264c99460327d48066e197c70576d308fa305412084722e83388b959b26cca1ef4aef3106b849f91e1d345c620cafece7b97426164dce31a56ca0736608b0b8ba6969a6c91e763d13db90bd9b213f7bd2a36f8ea5'

describe('provider registrations', () => {
  it('reads a collateral the ProRegTx itself created, address included', () => {
    expect(providerRegistration(Transaction.fromHex(INTERNAL_TX), INTERNAL, 1154851, 'testnet')).toEqual({
      height: 1154851, isEvo: false,
      collateralTxid: INTERNAL, collateralVout: 1, collateralAddress: '8oTdW2sryrLioQQv3BBGPTf7aKLT6LfbGr',
      ownerAddress: 'yLrHr1jPSrAi5bVk3Bij8T2iVAu2mHHeqw',
      payouts: [{height: 1154851, address: 'yeP7dbbKCZHhzrEHP6goTsPVqXJ91E2Bdy'}], platformP2PPort: null,
    })
  })

  it('reads an evonode spending an outside collateral, whose address it cannot know', () => {
    expect(providerRegistration(Transaction.fromHex(EVO_TX), EVO, 850334, 'testnet')).toEqual({
      height: 850334, isEvo: true,
      collateralTxid: '6ce8545e25d4f03aba1527062d9583ae01827c65b234bd979aca5954c6ae3a59', collateralVout: 32, collateralAddress: null,
      ownerAddress: 'yLMWYiFxCpPwim9YuosKAozkqsGf283XCa',
      payouts: [{height: 850334, address: 'yeRZBWYfeNE4yVUHV4ZLs83Ppn9aMRH57A'}], platformP2PPort: 36656,
    })
  })

  // The block confirmedHash points below is trusted for its height only.
  it('reads nothing from a transaction that is not the node\'s ProRegTx', () => {
    expect(providerRegistration(Transaction.fromHex(EVO_TX), INTERNAL, 850334, 'testnet')).toBeNull()
  })

  // Core resets a banned node's operator state, and its entry drops to version 1.
  it('keeps a banned evonode an evonode, and leaves what the list lacks null', () => {
    const banned = {...entry(1, MnType.Regular, false, '0.0.0.0'), nVersion: 1, address: null,
      keyIDVoting: Buffer.from(sdkUtils.addressToPublicKeyHash('yLMWYiFxCpPwim9YuosKAozkqsGf283XCa')).toString('hex')}
    const listed = listedMasternode(banned, providerRegistration(Transaction.fromHex(EVO_TX), EVO, 850334, 'testnet')!, 'testnet')
    expect(listed).toMatchObject({
      type: 'Evo', status: 'POSE_BANNED', serviceAddress: null, votingAddress: 'yLMWYiFxCpPwim9YuosKAozkqsGf283XCa',
      ownerAddress: 'yLMWYiFxCpPwim9YuosKAozkqsGf283XCa', platformP2PPort: 36656, registeredHeight: 850334,
      posePenaltyScore: null, lastPaidBlock: null, lastPaidTime: null,
    })
  })

  it('lists an entry not indexed yet without any ProRegTx field', () => {
    expect(listedMasternode(entry(1, MnType.Evo, true, '68.67.122.23', 1443), undefined, 'testnet')).toMatchObject({
      type: 'Evo', status: 'ENABLED', serviceAddress: '68.67.122.23:9999', platformHttpPort: 1443,
      ownerAddress: null, collateralTxid: null, collateralVout: null, payeeAddress: null, registeredHeight: null,
    })
  })

  it('reads a watched node\'s new payout, and ignores one it does not watch', () => {
    const payout = Script.fromHex('76a914c69a0bda7daaae481be8def95e5f347a1d00a4b488ac')
    const update = new Transaction([], [], 0, 3, TransactionType.TRANSACTION_PROVIDER_UPDATE_REGISTRAR,
      new ProUpRegTx(2, EVO, 0, '00'.repeat(48), '00'.repeat(20), payout, '00'.repeat(32), ''))
    expect(payoutUpdate(update, new Set([EVO]), 900000, 'testnet'))
      .toEqual({proTxHash: EVO, payoutAddress: 'yeRZBWYfeNE4yVUHV4ZLs83Ppn9aMRH57A', height: 900000})
    expect(payoutUpdate(update, new Set([INTERNAL]), 900000, 'testnet')).toBeNull()
  })

})

describe('applying and proving a diff', () => {
  const header = Uint8Array.from({length: 80}, (_, i) => i)
  // A diff under `header` whose coinbase commits to `committed`.
  const diffUnder = (mnList: SimplifiedMNListEntry[], deletedMNs: string[], committed: SimplifiedMNListEntry[]): MnListDiff =>
    Object.assign(diffOf(mnList, MnListDiff.calcMerkleRootMNList(committed)), {
      deletedMNs, blockHash: hashHeaderRaw(header),
      cbTx: {extraPayload: {version: 2, merkleRootQuorums: '0'.repeat(64)}},
      calcBlockMerkleRoot: () => wireToDisplayHex(header.subarray(36, 68)),
    })
  const [a, b, c] = [1, 2, 3].map(n => entry(n, MnType.Regular, true, '1.1.1.1'))
  const bBanned = {...b, isValid: false}

  it('applies a diff to the previous list: changed entries replaced, deleted ones dropped, new ones added', () => {
    const diff = diffUnder([bBanned, c], [a.proRegTxHash], [bBanned, c])
    const next = diff.applyTo([a, b])
    expect(next).toEqual([bBanned, c])
    expect(() => diff.verify(header, next, [])).not.toThrow()
  })

  it('refuses a list its coinbase does not commit to, or one under another header', () => {
    const wrong = diffUnder([c], [], [c])
    expect(() => wrong.verify(header, wrong.applyTo([a]), [])).toThrow('merkleRootMNList')
    const other = Object.assign(diffUnder([a], [], [a]), {blockHash: 'ff'.repeat(32)})
    expect(() => other.verify(header, other.applyTo([]), [])).toThrow('header hash')
  })
})
