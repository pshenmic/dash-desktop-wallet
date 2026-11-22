# Shared Masternodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-discover shared masternodes the wallet holds a share of and expose `isShared` + the share table (with our-share marks) through the existing `getMasternodes` IPC.

**Architecture:** The p2p ProRegTx registration index (chain.db) gains the share table; owner-chain matching searches share owner addresses too, so the existing gap walk finds shared nodes with no new scan. `NetworkMasternode` gains nullable `isShared`/`shares`; `Masternode` annotates shares with `keyIndex`/`imported`. rpc mode detects `isShared` from Dashscan's comma-joined owner list (no amounts served).

**Tech Stack:** TypeScript, Electron utility processes, local `dash-core-sdk` build (v3 ProRegTx + `CollateralShare`), vitest, Knex/SQLite (untouched), classic-level chain.db (JSON values).

**Spec:** `docs/superpowers/specs/2026-11-16-shared-masternodes-design.md`

## Global Constraints

- Backend only: `src/main` + `src/preload`. **Never edit `src/renderer`** — the DTO mirror there and all screens are the frontend dev's gap.
- **No commits.** Repository rule: leave changes staged for the user; never commit or push unless asked.
- p2p reads only the network; Dashscan is rpc-mode only.
- `bigint` crosses IPC/utility ports as itself — never stringify duffs on the way out. chain.db JSON is the one exception: share amounts are `number` there (≤ 1e11 duffs, safe integer), `bigint` from `listedMasternode` out.
- House style (CLAUDE.md): no comments except non-obvious why (1–2 lines); switch + return-per-case for discriminant dispatch; types/constants never in the using file; pure logic in `utils/`, unit-tested.
- Green gate (all five): `npx tsc --noEmit -p tsconfig.node.json`, `npx tsc --noEmit -p tsconfig.web.json`, `npx tsc --noEmit -p tests/tsconfig.json`, `npx vitest run`, `npx electron-vite build`.
- Fixture values are from the live testnet shared registration `5884221907e247d044102fbc3e20544b999ecbfc0fef3b4f8f4607da1f6f5abe` (verified 2026-11-16); the synthetic fixture below roundtrips through the local SDK with matching hash.

## Review Focus

1. A wallet holding **two shares of one node under two different keys** — both shares must be marked ours, not just the first. → Task 2 unit test.
2. A share owner key **past the first gap window** — the walk must widen on share matches exactly as on top-level owner matches. → Task 2 discovery test (index 55).
3. A shared node owned via the **creator's voting key with no share of ours** — listed, every share unmarked. → Task 2 discovery test.
4. A **banned shared node whose list entry fell back to v1** — still shared, from its indexed registration. → Task 2 `listedMasternode` test.
5. **chain.db rows written before the share table existed** — re-read once, never treated as solo forever. → Task 1 layout test.

---

### Task 1: Registration index stores the share table

**Files:**
- Modify: `src/main/p2p/types/masternodeList.ts` (`ProviderRegistration`, lines 16–29)
- Modify: `src/main/p2p/utils/masternodeList.ts` (`providerRegistration`, lines 54–69)
- Modify: `src/main/p2p/sync/providerRegistry.ts` (`load`, line 169)
- Test: `tests/unit/masternodeList.test.ts`, `tests/unit/providerRegistry.test.ts`

**Interfaces:**
- Consumes: local SDK `ProRegTX.shares?: CollateralShare[]`, `CollateralShare.getOwnerAddress(network): string`, `CollateralShare.amount: bigint`.
- Produces: `ProviderRegistration.shares: Array<{ownerAddress: string; amountDuffs: number}>` — empty for a solo node; `ownerAddress: null` for a shared one. Task 2 reads both.

- [ ] **Step 1: Add the shared fixture and failing tests to `tests/unit/masternodeList.test.ts`**

Imports to add: `CollateralShare, ExtNetInfo, OutPoint, Output` from `dash-core-sdk`; `ProRegTX` from `dash-core-sdk/src/types/ExtraPayload/ProRegTX.js` (deep import, the `ProUpRegTx` precedent). Fixture next to `INTERNAL_TX`/`EVO_TX`:

```ts
// The live testnet shared registration 58842219…0d05b's payload, rebuilt: three
// shares (500/300/200 DASH), null top-level owner, empty payouts, DSHC collateral
// at output 3.
function sharedRegistration(): Transaction {
  const p2pkh = (hash: string) => Script.fromHex(`76a914${hash}88ac`)
  const shares = [
    new CollateralShare(50000000000n, p2pkh('f5e39ebf4b0ede3685a8de904d71bea7c71a5f9d'), p2pkh('868a3bf8d8cf221118b526b9c6b114dc3b18e4d7'), 'f9aa3a6154ee3931509e23fac33af0ed91f11096'),
    new CollateralShare(30000000000n, p2pkh('92cc55887af36a89aa15f3b4b9b10511d2fe557d'), new Script(), '4a3d03d232aa03e67ec79a8325c61645602d2c16'),
    new CollateralShare(20000000000n, p2pkh('108877a8e51ff82bfe7204835f209efe3494182d'), new Script(), '7d431afc4359a48d477fddb8ccca0608397ad714'),
  ]
  const joinSigs = [
    '1fb68e4e453e74ae1b5eaa677579e261b6719f14f0de61432ce8230793846116a66a291f425403968fad987597da304b88cef1e62826893f4d64ca10a87cd3351f',
    '1f110694a0d0f27efaaadec3488306ed22a62e2f6aab63edfb3822e4e1764ac9b531c9145bd2b079aaf8093bf21ae5914eb122dd9c0f308a1cb99f96f3855048f0',
    '1fbce5eb3c04fffa982334b8951a5af3c14c0e91a2fa8986e4c5d676be6ef155eb63802112b07bf2ad4009ca8555f572ef05d118cc80b2bbabd0c196e030f916b7',
  ]
  const payload = new ProRegTX(3, 0, 0, new OutPoint('00'.repeat(32), 3), undefined, undefined,
    '00'.repeat(20), 'b1861e7cebdb77ae860788edf2d8b80fda62bcd4647a4cee6841b753b7c438b4c084554b2d71703891092b6d9e509f05',
    '40660b7a7c0ef6cd15a5cb8912cc86326661e19b', 500, new Script(), '00'.repeat(32),
    undefined, undefined, undefined, '',
    {netInfo: new ExtNetInfo(), payouts: [], shares, joinSigs, earlyPeriodBlocks: 17280, earlyPenalty: 500000000n})
  return new Transaction([], [
    new Output(3334n, p2pkh('f5e39ebf4b0ede3685a8de904d71bea7c71a5f9d')),
    new Output(3334n, p2pkh('92cc55887af36a89aa15f3b4b9b10511d2fe557d')),
    new Output(3332n, p2pkh('108877a8e51ff82bfe7204835f209efe3494182d')),
    new Output(100000000000n, Script.fromHex('04445348437551')),
  ], 0, 3, TransactionType.TRANSACTION_PROVIDER_REGISTER, payload)
}
```

New test in `describe('provider registrations')`:

```ts
it('reads a shared registration\'s share table, and no top-level owner', () => {
  const tx = sharedRegistration()
  expect(providerRegistration(tx, tx.hash(), 1588042, 'testnet')).toEqual({
    height: 1588042, isEvo: false,
    collateralTxid: tx.hash(), collateralVout: 3, collateralAddress: null,
    ownerAddress: null,
    payouts: [{height: 1588042, address: null}], platformP2PPort: null,
    shares: [
      {ownerAddress: 'yj5Z2cy5bGCva2DorKb8f4pJG7FoFSpBwk', amountDuffs: 50000000000},
      {ownerAddress: 'yT5ywnmTkPeUQG9fQ1BgKFFMo395YT9zCf', amountDuffs: 30000000000},
      {ownerAddress: 'yXjmhkKCaQx6ax3jkhema7ZMw7V3jFrjje', amountDuffs: 20000000000},
    ],
  })
})
```

Update the two existing solo `toEqual` expectations (INTERNAL, EVO): add `shares: []`.

- [ ] **Step 2: Add the layout test to `tests/unit/providerRegistry.test.ts` and fix the stale seed**

The seed in `'drops a node that left the list'` (line ~171) gains `shares: []` (it must stay new-layout, or the filter drops it before the list does and the assertion breaks). New test:

```ts
it('reads again a registration from before the share table was kept', async () => {
  store.registrations.set(EVO, {...{} as ProviderRegistration, height: REGISTERED, payouts: [{height: REGISTERED, address: null}]})
  await registry.offer(fullList([entry(EVO, CONFIRMED_HASH)]))
  registry.onBlock(peer as never, {block: registrationBlock()} as never)
  await vi.waitFor(() => expect(lists).toHaveLength(1))
  expect(store.registrations.get(EVO)!.shares).toEqual([])
})
```

- [ ] **Step 3: Run both files, verify the new tests fail**

Run: `npx vitest run tests/unit/masternodeList.test.ts tests/unit/providerRegistry.test.ts`
Expected: FAIL — `shares` missing from `providerRegistration` results; layout test times out (old row kept, no block fetched).

- [ ] **Step 4: Implement**

`ProviderRegistration` gains (inline array type, the `payouts` sibling convention):

```ts
// A shared registration's share table, empty for a solo node. number, not
// bigint: chain.db stores JSON; listedMasternode answers bigint.
shares: Array<{ownerAddress: string; amountDuffs: number}>
```

`providerRegistration`: `const shares = payload.shares ?? []` before the return; in the returned object `ownerAddress: shares.length > 0 ? null : payload.getOwnerAddress(network)` and `shares: shares.map(share => ({ownerAddress: share.getOwnerAddress(network), amountDuffs: Number(share.amount)}))`. Everything else unchanged (the internal-collateral branch already names the DSHC output's outpoint and gets `null` for its address).

`ProviderRegistry.load`: the filter becomes `Array.isArray(registration.payouts) && Array.isArray(registration.shares)`; the comment above it now reads "An entry without a payout history or share table is from an older layout: read it again."

- [ ] **Step 5: Run both files, verify pass**

Run: `npx vitest run tests/unit/masternodeList.test.ts tests/unit/providerRegistry.test.ts`
Expected: PASS (all tests in both files).

---

### Task 2: Network types, owner matching, ownership marks

**Files:**
- Modify: `src/main/src/types/Masternode.ts`
- Modify: `src/main/p2p/utils/masternodeList.ts` (`listedMasternode`, lines 86–108)
- Modify: `src/main/src/utils/masternodes.ts` (`networkMasternode`, `nodeKey` → `nodeKeyValues`, `matchMasternodeKeys`, `carriesKey`, `ownedMasternodes`)
- Modify: `src/main/src/providers/P2PWalletProvider.ts` (import line 17, filter lines 151–154)
- Modify: `src/main/src/services/core/MasternodeService.ts` (`discover`, lines 94–116)
- Test: `tests/unit/masternodeList.test.ts`, `tests/unit/masternodes.test.ts`, `tests/unit/p2pMasternodes.test.ts`, `tests/api/masternodeDiscovery.test.ts`

**Interfaces:**
- Consumes: Task 1's `ProviderRegistration.shares` / shared `ownerAddress: null`.
- Produces:
  - `MasternodeShare {ownerAddress: string; amountDuffs: bigint}` and `OwnedMasternodeShare extends MasternodeShare {keyIndex: number | null; imported: boolean}` in `src/main/src/types/Masternode.ts`.
  - `NetworkMasternode.isShared: boolean | null`, `NetworkMasternode.shares: MasternodeShare[] | null`; `Masternode.shares: OwnedMasternodeShare[] | null` (override).
  - `nodeKeyValues(filter: MasternodeKeyFilter, node: NetworkMasternode): string[]` — replaces `nodeKey` (deleted; consumers: `matchMasternodeKeys`, `carriesKey`, `P2PWalletProvider`, the discovery test's `source()`).
  - `ownedMasternodes(nodes, matches, imported, collateral, ownerIndexes: Map<string, number>): Masternode[]` — new last parameter, owner address → key index.

- [ ] **Step 1: Write the failing tests**

`tests/unit/masternodeList.test.ts` — add to `describe('provider registrations')` (uses Task 1's `sharedRegistration()`):

```ts
it('lists a shared node with its share table, amounts as bigint', () => {
  const tx = sharedRegistration()
  const listed = listedMasternode({...entry(1, MnType.Regular, true, '0.0.0.0'), nVersion: 3, address: null},
    providerRegistration(tx, tx.hash(), 1588042, 'testnet')!, 'testnet')
  expect(listed).toMatchObject({
    isShared: true, ownerAddress: null, payeeAddress: null,
    shares: [
      {ownerAddress: 'yj5Z2cy5bGCva2DorKb8f4pJG7FoFSpBwk', amountDuffs: 50000000000n},
      {ownerAddress: 'yT5ywnmTkPeUQG9fQ1BgKFFMo395YT9zCf', amountDuffs: 30000000000n},
      {ownerAddress: 'yXjmhkKCaQx6ax3jkhema7ZMw7V3jFrjje', amountDuffs: 20000000000n},
    ],
  })
})

// Core drops a banned node's entry to version 1; the registration still tells.
it('keeps a banned shared node shared, and a solo one not shared', () => {
  const tx = sharedRegistration()
  const banned = listedMasternode({...entry(1, MnType.Regular, false, '0.0.0.0'), nVersion: 1, address: null},
    providerRegistration(tx, tx.hash(), 1588042, 'testnet')!, 'testnet')
  expect(banned).toMatchObject({isShared: true, status: 'POSE_BANNED', type: 'Regular'})
  const solo = listedMasternode(entry(1, MnType.Regular, true, '0.0.0.0'),
    providerRegistration(Transaction.fromHex(INTERNAL_TX), INTERNAL, 1154851, 'testnet')!, 'testnet')
  expect(solo).toMatchObject({isShared: false, shares: []})
})
```

Extend the existing `'lists an entry not indexed yet…'` test's `toMatchObject` with `isShared: null, shares: null`.

`tests/unit/masternodes.test.ts` — the `node()` fixture gains `isShared: false, shares: []`; every `ownedMasternodes(...)` call gains a trailing `new Map()`; the `networkMasternode` test's `toMatchObject` gains `isShared: false, shares: null`. New tests:

```ts
it('reads a comma-joined owner list as shared, without amounts', () => {
  const row: DashscanMasternode = {
    proTxHash: 'p', address: '[::]:0', payee: 'ypayee1, ypayee2', status: 'POSE_BANNED', type: 'Regular', posPenaltyScore: 0,
    lastPaidTime: '1970-01-01T00:00:00.000Z', lastPaidBlock: 0, ownerAddress: 'yowner1, yowner2', votingAddress: 'yvoting',
    collateralAddress: 'UNKNOWN', pubKeyOperator: 'A73D', outpoint: `${'ab'.repeat(32)}-3`,
    platformNodeId: null, platformP2PPort: null, platformHTTPPort: null,
  }
  expect(networkMasternode(row)).toMatchObject({isShared: true, ownerAddress: null, payeeAddress: null, shares: null})
})
```

(in `describe('networkMasternode')`), and in `describe('masternode key matching')`:

```ts
it('matches an owner key held as a share of a shared registration', () => {
  const owner = masternodeKeyDeriver(keys, 'mainnet', 'owner').derive(2)
  const shared = node('a', {ownerAddress: null, isShared: true, shares: [
    {ownerAddress: owner.address, amountDuffs: 20000000000n},
    {ownerAddress: 'Xother', amountDuffs: 80000000000n},
  ]})
  expect([...matchMasternodeKeys('owner', [owner], [shared])]).toEqual([['a', 2]])
})
```

and in `describe('ownedMasternodes')`:

```ts
it('marks every share our keys hold, even two under different keys', () => {
  const shared = node('a', {ownerAddress: null, isShared: true, shares: [
    {ownerAddress: 'Xfirst', amountDuffs: 20000000000n},
    {ownerAddress: 'Xsecond', amountDuffs: 30000000000n},
    {ownerAddress: 'Xother', amountDuffs: 50000000000n},
  ]})
  const owned = ownedMasternodes([shared], {...none, owner: new Map([['a', 1]])}, [], [], new Map([['Xfirst', 1], ['Xsecond', 6]]))
  expect(owned[0].shares!.map(({keyIndex}) => keyIndex)).toEqual([1, 6, null])
})

it('owns a shared node by an imported share owner key, and marks that share', () => {
  const shared = node('a', {ownerAddress: null, isShared: true, shares: [
    {ownerAddress: 'Ximported', amountDuffs: 30000000000n},
    {ownerAddress: 'Xother', amountDuffs: 70000000000n},
  ]})
  const owned = ownedMasternodes([shared], none, [{role: 'owner', publicKey: 'Ximported'}], [], new Map())
  expect(owned.map(({proTxHash, importedRoles}) => [proTxHash, importedRoles])).toEqual([['a', ['owner']]])
  expect(owned[0].shares!.map(({keyIndex, imported}) => [keyIndex, imported])).toEqual([[null, true], [null, false]])
})
```

`tests/unit/p2pMasternodes.test.ts` — `node()` gains `isShared: false, shares: []`; new test:

```ts
it('finds a shared node by a share owner address', async () => {
  const shared = node('s', {ownerAddress: null, isShared: true, shares: [{ownerAddress: 'yshare', amountDuffs: 20000000000n}]})
  expect((await provider([shared, node('a')]).getMasternodes('owner', ['yshare']))!.map(({proTxHash}) => proTxHash)).toEqual(['s'])
})
```

`tests/api/masternodeDiscovery.test.ts` — `node()` gains `isShared: false, shares: []`; `source()`'s filter becomes `list?.filter(entry => nodeKeyValues(filter, entry).some(key => values.includes(key))) ?? null` (import `nodeKeyValues` instead of `nodeKey`). New tests:

```ts
it('discovers a shared node by a share owner key on the owner chain', async () => {
  const shareOwner = key('owner', 2)
  await discover(source([node('s', {ownerAddress: null, isShared: true, collateralVout: 3, collateralAddress: null, shares: [
    {ownerAddress: shareOwner, amountDuffs: 20000000000n},
    {ownerAddress: 'Xother', amountDuffs: 80000000000n},
  ]})]))
  const [found] = await owned()
  expect(found).toMatchObject({proTxHash: 's', ownerKeyIndex: 2, isShared: true})
  expect(found.shares).toEqual([
    {ownerAddress: shareOwner, amountDuffs: 20000000000n, keyIndex: 2, imported: false},
    {ownerAddress: 'Xother', amountDuffs: 80000000000n, keyIndex: null, imported: false},
  ])
  expect(await storedCollaterals()).toEqual(['s:ss:3'])
})

it('widens the owner walk past a key held as a share', async () => {
  await discover(source([node('s', {ownerAddress: null, isShared: true, shares: [
    {ownerAddress: key('owner', 55), amountDuffs: 20000000000n},
    {ownerAddress: 'Xother', amountDuffs: 80000000000n},
  ]})]))
  expect((await owned()).map(({proTxHash, ownerKeyIndex}) => [proTxHash, ownerKeyIndex])).toEqual([['s', 55]])
})

it('lists a shared node held by the creator\'s voting key with no share of ours', async () => {
  await discover(source([node('s', {votingAddress: key('voting', 0), ownerAddress: null, isShared: true, shares: [
    {ownerAddress: 'Xother1', amountDuffs: 60000000000n},
    {ownerAddress: 'Xother2', amountDuffs: 40000000000n},
  ]})]))
  const [found] = await owned()
  expect(found).toMatchObject({proTxHash: 's', ownerKeyIndex: null, votingKeyIndex: 0})
  expect(found.shares!.map(({keyIndex, imported}) => [keyIndex, imported])).toEqual([[null, false], [null, false]])
})

it('finds a shared node by an imported share owner key', async () => {
  const owner = PrivateKey.fromBytes(new Uint8Array(32).fill(9), 'mainnet')
  current = source([node('s', {ownerAddress: null, isShared: true, shares: [
    {ownerAddress: owner.getAddress(), amountDuffs: 20000000000n},
    {ownerAddress: 'Xother', amountDuffs: 80000000000n},
  ]})])
  const found = await masternodes.importKey(walletId, 'owner', owner.toWIF())
  expect(found!.map(({proTxHash, importedRoles}) => [proTxHash, importedRoles])).toEqual([['s', ['owner']]])
  expect(found![0].shares!.map(({keyIndex, imported}) => [keyIndex, imported])).toEqual([[null, true], [null, false]])
})
```

- [ ] **Step 2: Run the four files, verify the new tests fail**

Run: `npx vitest run tests/unit/masternodeList.test.ts tests/unit/masternodes.test.ts tests/unit/p2pMasternodes.test.ts tests/api/masternodeDiscovery.test.ts`
Expected: FAIL — `nodeKeyValues` not exported; `isShared`/`shares` absent from results.

- [ ] **Step 3: Implement the types and emission**

`src/main/src/types/Masternode.ts`:

```ts
// One participant's contribution to a shared masternode's collateral.
export interface MasternodeShare {
  ownerAddress: string
  amountDuffs: bigint
}

// A share with the wallet's marks: keyIndex is the owner-chain index holding it,
// null when the seed does not derive it; imported is an imported owner key.
export interface OwnedMasternodeShare extends MasternodeShare {
  keyIndex: number | null
  imported: boolean
}
```

`NetworkMasternode` gains `isShared: boolean | null` and `shares: MasternodeShare[] | null` (after `registeredHeight`; the existing null-convention comment already covers ProRegTx-derived fields — add "rpc serves no share amounts" only if not obvious from the mapper comment). `Masternode` gains `shares: OwnedMasternodeShare[] | null`.

`listedMasternode` gains:

```ts
isShared: registration == null ? null : registration.shares.length > 0,
shares: registration == null ? null : registration.shares.map(({ownerAddress, amountDuffs}) => ({ownerAddress, amountDuffs: BigInt(amountDuffs)})),
```

- [ ] **Step 4: Implement matching, the rpc mapper, and ownership marks**

`src/main/src/utils/masternodes.ts` — delete `nodeKey`, replace with:

```ts
// The values a filter searches the node by. The owner chain also searches the
// share table: a shared registration has no top-level owner key.
export function nodeKeyValues(filter: MasternodeKeyFilter, node: NetworkMasternode): string[] {
  switch (filter) {
    case 'owner':
      return [node.ownerAddress, ...(node.shares ?? []).map(({ownerAddress}) => ownerAddress)]
        .filter((address): address is string => address != null)
    case 'collateral':
      return node.collateralAddress == null ? [] : [node.collateralAddress]
    case 'voting':
      return [node.votingAddress]
    case 'operator':
      return [node.operatorPublicKey]
  }
}
```

`matchMasternodeKeys`: the per-node body becomes a loop over `nodeKeyValues(chain, node)`; on the first `indexByValue.get(key)` hit, `matches.set(node.proTxHash, index)` and break. `carriesKey`: `const values = masternodeFilterValues(role, publicKey); return nodeKeyValues(role, node).some(key => values.includes(key))`.

`networkMasternode`: `const shared = row.ownerAddress.includes(',')` with the one-line why ("A shared node's owner and payee are comma-joined share lists; no amounts are served."); `ownerAddress: shared ? null : row.ownerAddress`, `payeeAddress: shared ? null : row.payee`, `isShared: shared`, `shares: null`.

`ownedMasternodes`: new last parameter `ownerIndexes: Map<string, number>`; the per-node map gains:

```ts
shares: node.shares?.map(share => ({
  ...share,
  keyIndex: ownerIndexes.get(share.ownerAddress) ?? null,
  imported: imported.some(key => key.role === 'owner' && key.publicKey === share.ownerAddress),
})) ?? null,
```

`P2PWalletProvider.ts`: import `nodeKeyValues`; the filter becomes `.filter(node => nodeKeyValues(filter, node).some(key => wanted.has(key)))`.

`MasternodeService.discover`: `const ownerIndexes = new Map<string, number>()` beside `matches`; first line of the `probe` closure: `if (chain === 'owner') for (const {index, address} of derived) ownerIndexes.set(address, index)`; pass `ownerIndexes` as the fifth argument to `ownedMasternodes`. Nothing else changes — the collateral flow stays (a shared node's stored outpoint is the DSHC output, never a wallet coin).

- [ ] **Step 5: Run the four files, verify pass**

Run: `npx vitest run tests/unit/masternodeList.test.ts tests/unit/masternodes.test.ts tests/unit/p2pMasternodes.test.ts tests/api/masternodeDiscovery.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck all three projects**

Run: `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json && npx tsc --noEmit -p tests/tsconfig.json`
Expected: no errors (the new required fields surface any missed fixture; renderer is untouched and its DTO simply lacks the new fields, which is the frontend gap, not an error).

---

### Task 3: Preload mirror, docs, green gate

**Files:**
- Modify: `src/preload/index.d.ts` (`MasternodeDTO`, lines 84–107; mirror comment line 68)
- Modify: `docs/p2p.md` (Masternode list section)

**Interfaces:**
- Consumes: Task 2's `MasternodeShare`/`OwnedMasternodeShare` shapes and `Masternode` fields.
- Produces: the `Window.electronAPI.getMasternodes` contract the frontend dev builds against.

- [ ] **Step 1: Mirror the DTO in `src/preload/index.d.ts`**

```ts
interface MasternodeShareDTO {
  ownerAddress: string
  amountDuffs: bigint
}

interface OwnedMasternodeShareDTO extends MasternodeShareDTO {
  keyIndex: number | null
  imported: boolean
}
```

`MasternodeDTO` gains `isShared: boolean | null` and `shares: OwnedMasternodeShareDTO[] | null`; the mirror comment adds the two share types. `definitions.ts` needs no change (the wrapper is shape-agnostic).

- [ ] **Step 2: Add the p2p doc bullet**

In `docs/p2p.md`'s "Masternode list" section, after the "A list entry has no owner key, collateral or payout" bullet:

```markdown
- **A shared registration carries its share table.** The index keeps each
  share's owner address and amount, and the owner search matches them too — a
  shared node has no top-level owner key. Entries indexed before the share table
  was kept are read again once.
```

- [ ] **Step 3: Full green gate**

Run all five, in order:
1. `npx tsc --noEmit -p tsconfig.node.json`
2. `npx tsc --noEmit -p tsconfig.web.json`
3. `npx tsc --noEmit -p tests/tsconfig.json`
4. `npx vitest run` — expected: full suite green, no failures
5. `npx electron-vite build` — no font `didn't resolve at build time` warning

- [ ] **Step 4: Stage the changes for the user (no commit)**

`git add` the exact touched files (src/main, src/preload, tests, docs/p2p.md, docs/superpowers); `git status` to verify nothing under `src/renderer` is staged. Report the gate results and the rpc-mode gap.
