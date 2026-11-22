# Shared Masternode Registration Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the wallet coordinate a Dash Core v24 shared masternode registration end to end — build the deterministic v3 ProRegTx, combine every member's consent signature, assemble their funding signatures and broadcast it.

**Architecture:** Pure validation and transaction construction go in a new `utils/sharedMasternodeRegistration.ts`; `MasternodeService` resolves prevouts through DAPI, combines consents, assembles funding and broadcasts; four IPC handlers expose the flow to preload. The participant-side endpoints (`previewSharedRegistration`, `signSharedRegistrationConsent`, `signSharedRegistrationFunding`) already exist and are used unchanged.

**Tech Stack:** TypeScript, Electron utility processes, local `dash-core-sdk` (`ProRegTX` v3, `CollateralShare`, `ExtNetInfo`), vitest, DAPI through `coreSDK(network).getTransaction`.

**Spec:** `docs/superpowers/specs/2026-11-16-shared-masternodes-design.md` covers discovery and participant signing; this plan implements the creation flow it listed as a non-goal. The transaction layout is fixed by `dash-trustless-staking/DESIGN.md` §6–§7. The reference implementation of the same algorithm is `dash-trustless-staking/src/lib/registration.ts` and `src/lib/signFunding.ts`; when this plan and those disagree, the design document wins.

## Global Constraints

- **Backend only.** `src/main` and `src/preload`. Do not edit `src/renderer` — the renderer wrapper is the frontend dev's gap, as the existing shared flow already does.
- **ProRegTx v3 for every payload this plan writes.** `nVersion = 3`, shared registrations are `nType = 0` (Regular only, per consensus), `nMode = 0`. There is no v2 branch in the new code. Moving solo/Evo registrations to v3 is a **separate** plan: v3 replaces `scriptPayout` with a `payouts` reward-split list, which changes the payout index in discovery, so it is not a version bump.
- Shared registrations have `keyIDOwner = null` (`'00'.repeat(20)`), `payouts = []`, `scriptPayout = empty`, `vchSig = ''`.
- 2–8 shares, each at least 100 DASH, summing to exactly 1000 DASH.
- Refund and reward scripts are P2PKH or P2SH and must not pay the voting key or any share owner key. Reward defaults to the refund script, encoded as an empty script.
- Owner keys and refund scripts are unique within the draft.
- `nEarlyPeriodBlocks <= 420480`; `nEarlyPenalty` is 0 when the period is 0 and otherwise strictly below the smallest share.
- Inputs are each member's outpoints in member order, all `nSequence = 0xffffffff`.
- Every member pays its own share plus `feeShare`; creator-paid fee inputs are not part of this plan.
- Fee split: `feeShare[i] = floor(fee / n)` for every member, the last also takes the remainder.
- Change per member: `sum(inputs) − amount − feeShare`; refuse a negative change; drop a positive change below 546 duffs (it becomes extra fee).
- Outputs: member change outputs in member order, then the collateral output last. `collateralIndex = outputs.length − 1`. The payload's collateral outpoint is a zero txid and `vOut = collateralIndex`.
- Collateral output: exactly 1000 DASH to `Script.sharedCollateral()` (`04445348437551`).
- `inputsHash` is `tx.providerInputsHash()` (display order; the SDK reverses it when serializing).
- Consent signatures: base64 between wallets, hex inside `vchJoinSigs`, share order, 65 bytes each. Consent is signed before funding because the consent digest excludes scriptSigs and join signatures.
- Funding signatures: SIGHASH_ALL, after `vchJoinSigs` are final. They cover the payload.
- `bigint` crosses IPC as itself. No seed is cached; the wallet unlocks only for signing.
- House style: no comments except non-obvious protocol facts (1–2 lines); pure logic in `utils/`, unit-tested; constants and types never in the file that uses them.
- Green gate: `npx tsc --noEmit -p tsconfig.node.json`, `npx tsc --noEmit -p tsconfig.web.json`, `npx tsc --noEmit -p tests/tsconfig.json`, `npx vitest run`, `npx electron-vite build`.
- Commit at the end of each task.

## Review Focus

1. **A member's inputs do not cover `amount + feeShare`.** The builder must throw naming that member; it must never emit a negative or silently zero change.
2. **DAPI cannot return a funding parent.** Refuse the build; never substitute 0 or skip the outpoint.
3. **Consensus-invalid share tables** (duplicate owner or refund script, refund/reward paying the voting key or an owner, penalty too large, 1 or 9 shares). Refuse before any member signs.
4. **A contribution signed over different bytes.** Refuse it; merge only the declared inputs of a contribution whose script-stripped body equals the joined transaction.
5. **Dust change below 546 duffs.** It is omitted and raises the actual fee; the plan must report the actual fee, not the nominal `feeDuffs`.
6. **Fee-split rounding.** Two members and a 100,001-duff fee must give `[50_000, 50_001]`, not `[50_000, 50_000]` plus a lost duff.

---

## File Structure

- `src/main/src/constants/chain.ts` — shared registration limits.
- `src/main/src/types/Masternode.ts` — draft, plan, contribution and result types (siblings of the existing shared-registration types).
- `src/main/src/utils/sharedMasternodeRegistration.ts` (new) — address-to-script, draft validation, deterministic builder. Pure; no DAO, no provider.
- `src/main/src/services/core/MasternodeService.ts` — prevout resolution, build/combine/assemble/broadcast methods.
- `src/main/src/api/masternodes/` — four handler classes, one per channel.
- `src/main/src/WalletBackend.ts` — register the handlers.
- `src/preload/index.d.ts` — DTO mirrors (hand-maintained; no renderer edits).
- `tests/unit/sharedMasternodeRegistration.test.ts` (new) — validation and builder.
- `tests/api/sharedMasternodeCoordinator.test.ts` (new) — service flow end to end.

---

### Task 1: Draft model, limits and validation

**Files:**
- Modify: `src/main/src/constants/chain.ts`
- Modify: `src/main/src/types/Masternode.ts`
- Create: `src/main/src/utils/sharedMasternodeRegistration.ts`
- Test: `tests/unit/sharedMasternodeRegistration.test.ts`

**Interfaces:**
- Consumes: `DUFFS_PER_DASH`, `MASTERNODE_COLLATERAL_DUFFS.Regular`, `ADDRESS_PREFIX`, `Base58Check` (`dash-core-sdk/src/base58check.js`), `sdkUtils.addressToPublicKeyHash`, `requireBasicOperatorKey`, `serviceAddressParts`.
- Produces:
  - `SHARED_REGISTRATION_MIN_SHARES = 2`, `SHARED_REGISTRATION_MAX_SHARES = 8`, `SHARED_REGISTRATION_MIN_SHARE_DUFFS = 100n * DUFFS_PER_DASH`, `SHARED_REGISTRATION_MAX_EARLY_PERIOD_BLOCKS = 420_480` in `constants/chain.ts`.
  - `SharedRegistrationOutpoint {txid: string; vout: number}`
  - `SharedRegistrationMemberDraft {amountDuffs: bigint; ownerAddress: string; refundAddress: string; rewardAddress: string | null; changeAddress: string; inputs: SharedRegistrationOutpoint[]}`
  - `SharedRegistrationDraft {members: SharedRegistrationMemberDraft[]; serviceAddress: string | null; operatorPublicKey: string; votingAddress: string; operatorReward: number; earlyPeriodBlocks: number; earlyPenaltyDuffs: bigint; feeDuffs: bigint}`
  - `requireSharedRegistrationDraft(draft: SharedRegistrationDraft, network: Network): void`
  - `sharedRegistrationScript(address: string, network: Network): Script` (P2PKH `76a914…88ac`, P2SH `a914…87`)

- [ ] **Step 1: Write the failing validation tests**

Create `tests/unit/sharedMasternodeRegistration.test.ts` with a two-member fixture:

```ts
const DASH = 100_000_000n
const address = (byte: number): string =>
  PrivateKey.fromBytes(new Uint8Array(32).fill(byte), 'mainnet').getAddress()
const member = (fields: Partial<SharedRegistrationMemberDraft> = {}): SharedRegistrationMemberDraft => ({
  amountDuffs: 600n * DASH,
  ownerAddress: address(1),
  refundAddress: address(2),
  rewardAddress: null,
  changeAddress: address(3),
  inputs: [{txid: 'aa'.repeat(32), vout: 0}],
  ...fields,
})
const draft = (members = [member(), member({amountDuffs: 400n * DASH, ownerAddress: address(4), refundAddress: address(5), changeAddress: address(6), inputs: [{txid: 'bb'.repeat(32), vout: 0}]})]): SharedRegistrationDraft => ({
  members,
  serviceAddress: '1.2.3.4:19999',
  operatorPublicKey: 'b1861e7cebdb77ae860788edf2d8b80fda62bcd4647a4cee6841b753b7c438b4c084554b2d71703891092b6d9e509f05',
  votingAddress: address(7),
  operatorReward: 0,
  earlyPeriodBlocks: 1_000,
  earlyPenaltyDuffs: 1_000_000n,
  feeDuffs: 100_000n,
})
```

The addresses are real mainnet P2PKH so `sharedRegistrationScript` is exercised; use a P2SH address (a `Script.fromHex('a914…87')`-paired address or a known mainnet P2SH) in the script helper's own test. Tests:

```ts
it('accepts a two-member draft whose shares add up to 1000 DASH', () => {
  expect(() => requireSharedRegistrationDraft(draft(), 'mainnet')).not.toThrow()
})

it('refuses fewer than two or more than eight shares', () => { /* 1 member, 9 members */ })
it('refuses a share below 100 DASH or a table that does not sum to 1000', () => { /* 99 DASH; 500/400 */ })
it('refuses duplicate owner keys or duplicate refund scripts', () => { /* same ownerAddress; same refundAddress */ })
it('refuses a refund or reward script paying the voting key or a share owner', () => { /* refundAddress = voting; rewardAddress = member[0].ownerAddress */ })
it('refuses an early penalty that is not below the smallest share, or a penalty with no early period', () => { /* penalty = 600 DASH; blocks 0 + penalty 1 */ })
it('refuses more than 420480 early-period blocks, an unknown operator key and a non-P2PKH voting key', () => {})
it('refuses duplicate funding outpoints, including across members', () => {})
it('builds P2PKH and P2SH scripts and refuses a wrong-network or unknown prefix', () => {})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/sharedMasternodeRegistration.test.ts`
Expected: FAIL with `Cannot find module '../../src/main/src/utils/sharedMasternodeRegistration'`.

- [ ] **Step 3: Add the constants and types**

In `constants/chain.ts`, beside `MASTERNODE_COLLATERAL_DUFFS`:

```ts
export const SHARED_REGISTRATION_MIN_SHARES = 2
export const SHARED_REGISTRATION_MAX_SHARES = 8
export const SHARED_REGISTRATION_MIN_SHARE_DUFFS = 100n * DUFFS_PER_DASH
export const SHARED_REGISTRATION_MAX_EARLY_PERIOD_BLOCKS = 420_480
```

In `types/Masternode.ts`, below `SharedRegistrationShare`, add the draft and member types exactly as listed in **Produces** above.

- [ ] **Step 4: Implement validation**

`requireSharedRegistrationDraft` throws on the first violation, in this order:

1. Member count within 2–8.
2. Every amount `>= 100 DASH`; sum equals `MASTERNODE_COLLATERAL_DUFFS.Regular`.
3. Owner addresses unique; refund scripts unique (compare script hex).
4. Every owner is P2PKH; refund, reward and change are P2PKH or P2SH.
5. No refund or reward script equals the voting script or any owner script.
6. Voting is P2PKH; operator is basic BLS (`requireBasicOperatorKey`); operator reward 0–10000.
7. `serviceAddress` parses via `serviceAddressParts` when not null.
8. Early period ≤ 420480; penalty 0 iff period 0; penalty < smallest share.
9. `feeDuffs > 0`; every member has at least one input; outpoint txids are 64 hex chars and vouts are non-negative; no outpoint appears twice in the draft.

`sharedRegistrationScript` decodes with `Base58Check`, rejects anything that is not the network's P2PKH/P2SH prefix, and returns the two templates above. Reuse `ADDRESS_DECODED_LENGTH` from `constants/addresses.ts`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/sharedMasternodeRegistration.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/src/constants/chain.ts src/main/src/types/Masternode.ts src/main/src/utils/sharedMasternodeRegistration.ts tests/unit/sharedMasternodeRegistration.test.ts
git commit -m "feat: validate shared masternode registration drafts"
```

---

### Task 2: Deterministic registration transaction

**Files:**
- Modify: `src/main/src/utils/sharedMasternodeRegistration.ts`
- Test: `tests/unit/sharedMasternodeRegistration.test.ts`

**Interfaces:**
- Consumes: Task 1's draft types and `sharedRegistrationScript`; the existing `SharedRegistrationOutput`.
- Produces:
  - `SharedRegistrationPrevout {satoshis: bigint; script: Script}`
  - `SharedRegistrationMemberPlan {index: number; amountDuffs: bigint; feeDuffs: bigint; changeDuffs: bigint; inputIndexes: number[]}`
  - `SharedRegistrationPlan {txHex: string; consentHash: string; collateralIndex: number; collateralDuffs: bigint; actualFeeDuffs: bigint; members: SharedRegistrationMemberPlan[]; outputs: SharedRegistrationOutput[]}`
  - `sharedRegistrationTx(draft: SharedRegistrationDraft, prevouts: Map<string, SharedRegistrationPrevout>, network: Network): {tx: Transaction; plan: SharedRegistrationPlan}`
  - `sharedRegistrationOutpointKey(outpoint: SharedRegistrationOutpoint): string` (`txid:vout`)

- [ ] **Step 1: Write the failing builder tests**

Use the Task 1 draft with these prevouts:

```ts
const p2pkh = (byte: string): Script => Script.fromHex(`76a914${byte.repeat(20)}88ac`)
const prevouts = new Map<string, SharedRegistrationPrevout>([
  [`${'aa'.repeat(32)}:0`, {satoshis: 60_000_100_000n, script: p2pkh('11')}], // 600.001 DASH
  [`${'bb'.repeat(32)}:0`, {satoshis: 40_000_050_000n, script: p2pkh('22')}], // 400.0005 DASH
])

const expectedInputsHash = (tx: Transaction): string =>
  bytesToHex(doubleSHA256(concatBytes(
    ...tx.inputs.map(input => new OutPoint(input.txId, input.vOut).bytes()),
  )).toReversed())
```

`p2pkh(byte)` builds `76a914<byte×20>88ac`; `doubleSHA256` and `concatBytes` come from `@noble/hashes`. Fee 100,000 → 50,000 each; member A's change is 50,000; member B's is 0. Assertions:

```ts
it('orders inputs by member, splits the fee and puts the collateral last', () => {
  const {tx, plan} = sharedRegistrationTx(draft(), prevouts, 'mainnet')
  expect(tx.inputs.map(i => [i.txId, i.vOut])).toEqual([['aa'.repeat(32), 0], ['bb'.repeat(32), 0]])
  expect(tx.inputs.every(i => i.sequence === 0xffffffff)).toBe(true)
  expect(tx.outputs.map(o => [o.script.hex(), o.satoshis])).toEqual([
    [sharedRegistrationScript(address(3), 'mainnet').hex(), 50_000n],
    [Script.sharedCollateral().hex(), 1_000n * DASH],
  ])
  expect(plan.collateralIndex).toBe(1)
  expect(plan.members.map(m => [m.feeDuffs, m.changeDuffs])).toEqual([[50_000n, 50_000n], [50_000n, 0n]])
  expect(plan.actualFeeDuffs).toBe(100_000n)
})

it('refuses a member whose inputs do not cover its share and fee share', () => {
  const short = new Map(prevouts)
  short.set(`${'aa'.repeat(32)}:0`, {satoshis: 60_000_000_000n, script: p2pkh('11')})
  expect(() => sharedRegistrationTx(draft(), short, 'mainnet')).toThrow('member 1')
})

it('drops dust change and reports the higher actual fee', () => {
  const dusty = new Map(prevouts)
  dusty.set(`${'aa'.repeat(32)}:0`, {satoshis: 60_000_050_100n, script: p2pkh('11')}) // 100 duffs change
  const {tx, plan} = sharedRegistrationTx(draft(), dusty, 'mainnet')
  expect(tx.outputs).toHaveLength(1) // collateral only
  expect(plan.members[0].changeDuffs).toBe(0n)
  expect(plan.actualFeeDuffs).toBe(100_100n) // the 100-duff change became fee
})

it('gives the fee remainder to the last member', () => {
  const {plan} = sharedRegistrationTx({...draft(), feeDuffs: 100_001n}, prevouts, 'mainnet')
  expect(plan.members.map(m => m.feeDuffs)).toEqual([50_000n, 50_001n])
})

it('writes a v3 Regular payload with the share table and zero join signatures', () => {
  const {tx, plan} = sharedRegistrationTx(draft(), prevouts, 'mainnet')
  const payload = tx.extraPayload as ProRegTX
  expect(payload.version).toBe(3)
  expect(payload.type).toBe(0)
  expect(payload.keyIdOwner).toBe('00'.repeat(20))
  expect(payload.collateralOutpoint).toMatchObject({txId: '00'.repeat(32), vOut: plan.collateralIndex})
  expect(payload.joinSigs).toEqual(['00'.repeat(65), '00'.repeat(65)])
  expect(payload.shares?.map(s => s.amount)).toEqual([60_000_000_000n, 40_000_000_000n])
  expect(payload.shares?.[1].scriptReward.hex()).toBe('') // reward defaults to refund
  expect(payload.inputsHash).toBe(tx.providerInputsHash())
  // and independently: SHA256d over the serialized prevouts, byte-reversed
  expect(payload.inputsHash).toBe(expectedInputsHash(tx))
  expect(payload.payloadSig).toBe('')
  expect(plan.consentHash).toBe(tx.consentHash())
  expect(plan.txHex).toBe(tx.hex())
})

it('builds the same bytes twice', () => {
  expect(sharedRegistrationTx(draft(), prevouts, 'mainnet').tx.hex())
    .toBe(sharedRegistrationTx(draft(), prevouts, 'mainnet').tx.hex())
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/sharedMasternodeRegistration.test.ts`
Expected: FAIL — `sharedRegistrationTx` not exported.

- [ ] **Step 3: Implement the builder**

Order of operations:

1. Call `requireSharedRegistrationDraft`.
2. Build inputs from every member's outpoints in order: `new Input(txid, vout, new Script(), SEQUENCE_FINAL)`.
3. Look up each input's prevout; throw `A funding input is not available: <txid>:<vout>` when missing.
4. Compute `feeShares`: `fee / n` rounded down; add the remainder to the last entry.
5. For each member: `change = sum(values) − amount − feeShare`. Throw `member <index+1> cannot cover its share and fee share` if negative. Push an output when `change >= DUST_THRESHOLD_DUFFS`; otherwise record `changeDuffs = 0`.
6. Append the collateral output (`Script.sharedCollateral()`, 1000 DASH); `collateralIndex = outputs.length − 1`. Create `new Transaction(inputs, outputs, 0, 3, TransactionType.TRANSACTION_PROVIDER_REGISTER)`.
7. Build shares in member order:

```ts
new CollateralShare(
  member.amountDuffs,
  sharedRegistrationScript(member.refundAddress, network),
  member.rewardAddress == null ? new Script() : sharedRegistrationScript(member.rewardAddress, network),
  bytesToHex(sdkUtils.addressToPublicKeyHash(member.ownerAddress)),
)
```

8. Build `netInfo` the way `CoreTransactionService.proUpServPayload` does for v3: an empty `ExtNetInfo` when `serviceAddress == null`, otherwise one `CORE_P2P` entry from `serviceAddressParts(serviceAddress, network)`.
9. Construct the payload in this exact argument order:

```ts
new ProRegTX(
  3, 0, 0,
  new OutPoint('00'.repeat(32), collateralIndex),
  undefined, undefined,
  '00'.repeat(20),
  draft.operatorPublicKey,
  bytesToHex(sdkUtils.addressToPublicKeyHash(draft.votingAddress)),
  draft.operatorReward,
  new Script(),
  tx.providerInputsHash(),
  undefined, undefined, undefined,
  '',
  {netInfo, payouts: [], shares, joinSigs: shares.map(() => '00'.repeat(65)),
   earlyPeriodBlocks: draft.earlyPeriodBlocks, earlyPenalty: draft.earlyPenaltyDuffs},
)
```

10. `tx.extraPayload = payload`, set `tx.type = TransactionType.TRANSACTION_PROVIDER_REGISTER`, and compute `consentHash = tx.consentHash()` and `txHex = tx.hex()`.
11. Map `tx.outputs` to `SharedRegistrationOutput` for the plan (`address` null where the script has none, `collateral` true for the DSHC output) and compute `actualFeeDuffs = total inputs − sum(outputs)`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/sharedMasternodeRegistration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/src/utils/sharedMasternodeRegistration.ts tests/unit/sharedMasternodeRegistration.test.ts
git commit -m "feat: build deterministic shared masternode registrations"
```

---

### Task 3: Build endpoint and prevout resolution

**Files:**
- Modify: `src/main/src/services/core/MasternodeService.ts`
- Create: `src/main/src/api/masternodes/buildSharedMasternodeRegistration.ts`
- Modify: `src/main/src/WalletBackend.ts`
- Modify: `src/preload/index.d.ts`
- Test: `tests/api/sharedMasternodeCoordinator.test.ts`

**Interfaces:**
- Consumes: Task 2's `sharedRegistrationTx`, `sharedRegistrationOutpointKey`; the draft types.
- Produces:
  - `MasternodeService.buildSharedRegistration(walletId: string, draft: SharedRegistrationDraft): Promise<SharedRegistrationPlan>`
  - IPC `buildSharedMasternodeRegistration(walletId, draft): Promise<SharedRegistrationPlan>` with preload DTO mirrors for the draft and plan.

- [ ] **Step 1: Write the failing API test**

Create `tests/api/sharedMasternodeCoordinator.test.ts` modelled on `tests/api/sharedMasternodeSigning.test.ts`. Mock DAPI at module level, the precedent being `tests/api/prevOutService.test.ts`:

```ts
const parents = new Map<string, Uint8Array>()
const getTransaction = vi.fn(async (txid: string) => {
  const transaction = parents.get(txid)
  if (transaction == null) throw new Error(`Tx ${txid} not found`)
  return {transaction}
})
vi.mock('../../src/main/src/utils/coreSDK', () => ({coreSDK: () => ({getTransaction})}))
```

Seed two parent transactions built with `new Transaction([], [new Output(satoshis, script)], 0, 3, TransactionType.TRANSACTION_NORMAL)`, paying 600.001 and 400.0005 DASH so the 600/400 shares plus a 100,000-duff fee leave the expected change. The draft uses their txids. Derive the two share owner addresses from the wallet (`masternodeKeyDeriver(keys, 'mainnet', 'owner').derive(0/1)`) so the consent step can sign both, and use receiving-chain addresses for refund/reward/change. The provider stub answers `getMasternodes` with an empty list and `getWalletUtxos` with coins at two of the wallet's receiving addresses, one per member, whose `txId`/`vOut` match the parents and whose scripts match those addresses; the parents' outputs pay the same scripts. That is what lets `signSharedRegistrationFunding` resolve and sign both inputs later. Assert:

```ts
it('builds a plan whose inputs resolve through DAPI', async () => {
  const plan = await masternodes.buildSharedRegistration(walletId, draft)
  expect(plan.members.map(m => m.inputIndexes)).toEqual([[0], [1]])
  expect(Transaction.fromHex(plan.txHex).inputs).toHaveLength(2)
  expect(plan.collateralIndex).toBe(1)
})

it('refuses when a funding parent cannot be read', async () => {
  parents.delete('aa'.repeat(32))
  await expect(masternodes.buildSharedRegistration(walletId, draft)).rejects.toThrow('not available')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/api/sharedMasternodeCoordinator.test.ts`
Expected: FAIL — `buildSharedRegistration` is not a function.

- [ ] **Step 3: Implement prevout resolution and the method**

In `MasternodeService`:

```ts
async buildSharedRegistration(walletId: string, draft: SharedRegistrationDraft): Promise<SharedRegistrationPlan> {
  const wallet = await requireWallet(this.walletDAO, walletId)
  requireSharedRegistrationDraft(draft, wallet.network)
  const provider = this.providers.forWallet(walletId, wallet.network)
  await provider.ensureReadyToList()
  await this.requireFreeOperatorKey(draft.operatorPublicKey, provider)
  const prevouts = await this.sharedRegistrationPrevouts(wallet.network, draft)
  return sharedRegistrationTx(draft, prevouts, wallet.network).plan
}
```

`sharedRegistrationPrevouts` (private) collects every outpoint from `draft.members`, reads each distinct txid once through `coreSDK(network).getTransaction(txid)`, parses it with `Transaction.fromBytes(transaction)`, takes the output at `vout`, and answers `{satoshis, script}`. Throw `A funding input is not available: <txid>:<vout>` when the read fails, the output is missing, or the txid is not 64 hex chars. Do not fall back to wallet UTXOs: the draft's members may be other wallets.

For the owner check, `provider.getMasternodes('owner', ownerAddresses)` returning a non-empty list means one of the draft's owners already owns a node (the provider matches both top-level owners and share owners): throw `The owner key of member <index+1> already owns a masternode`. Null from that call means the list has not arrived: throw `The masternode list has not arrived yet`. `requireFreeOperatorKey` already throws when no list has arrived and when any listed node carries the operator key under either BLS encoding.

- [ ] **Step 4: Add the handler and register it**

`src/main/src/api/masternodes/buildSharedMasternodeRegistration.ts` follows the existing handler shape (constructor takes `MasternodeService`, `handle = async (_event, walletId, draft) => this.masternodes.buildSharedRegistration(walletId, draft)`).

In `WalletBackend.initHandlers`, beside `previewSharedMasternodeRegistration`:

```ts
registerHandler('buildSharedMasternodeRegistration', new BuildSharedMasternodeRegistrationHandler(this.masternodeService).handle)
```

- [ ] **Step 5: Mirror the DTOs in preload**

Add `SharedRegistrationOutpointDTO`, `SharedRegistrationMemberDraftDTO`, `SharedRegistrationDraftDTO`, `SharedRegistrationMemberPlanDTO`, `SharedRegistrationPlanDTO` to `src/preload/index.d.ts`, reusing `SharedRegistrationOutputDTO`. Add the channel to `Window.electronAPI`:

```ts
buildSharedMasternodeRegistration: (walletId: string, draft: SharedRegistrationDraftDTO) => Promise<SharedRegistrationPlanDTO>
```

Add the matching entry to `src/preload/definitions.ts`. It is an explicit `ipcRenderer.invoke` map, not a proxy, so a channel declared only in the `.d.ts` is `undefined` at runtime. Mirror the draft type there beside the other Masternode mirrors.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/api/sharedMasternodeCoordinator.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/src/services/core/MasternodeService.ts src/main/src/api/masternodes/buildSharedMasternodeRegistration.ts src/main/src/WalletBackend.ts src/preload/index.d.ts tests/api/sharedMasternodeCoordinator.test.ts
git commit -m "feat: add shared registration build endpoint"
```

---

### Task 4: Combine consent signatures

**Files:**
- Modify: `src/main/src/types/Masternode.ts`
- Modify: `src/main/src/services/core/MasternodeService.ts`
- Create: `src/main/src/api/masternodes/combineSharedMasternodeRegistration.ts`
- Modify: `src/main/src/WalletBackend.ts`
- Modify: `src/preload/index.d.ts`
- Test: `tests/api/sharedMasternodeCoordinator.test.ts`

**Interfaces:**
- Consumes: `SharedRegistrationSignature` (existing), `sharedRegistrationConsentSigner`, `sharedRegistrationShares`, `sharedRegistrationCollateralDuffs`.
- Produces:
  - `SharedRegistrationJoined {txHex: string; consentHash: string}`
  - `MasternodeService.combineSharedRegistration(walletId: string, txHex: string, signatures: SharedRegistrationSignature[]): Promise<SharedRegistrationJoined>`
  - IPC `combineSharedMasternodeRegistration(walletId, txHex, signatures)`.

- [ ] **Step 1: Write the failing test**

In the API test, after building a plan, sign both shares with the wallet's consent endpoint (the wallet holds both owner keys at indexes 0 and 1), then combine:

```ts
it('combines one consent per share into the payload join signatures', async () => {
  const plan = await masternodes.buildSharedRegistration(walletId, draft)
  const consent = await masternodes.signSharedRegistrationConsent(walletId, plan.txHex, PASSWORD)
  const joined = await masternodes.combineSharedRegistration(walletId, plan.txHex, consent.signatures)
  const payload = Transaction.fromHex(joined.txHex).extraPayload as ProRegTX
  expect(payload.joinSigs).toEqual(consent.signatures
    .sort((a, b) => a.shareIndex - b.shareIndex)
    .map(s => Buffer.from(s.signature, 'base64').toString('hex')))
  expect(joined.consentHash).toBe(plan.consentHash)
})

it('refuses a missing, duplicated or wrong-owner consent', async () => {
  // missing one share index; the same index twice; a signature from a different key
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/api/sharedMasternodeCoordinator.test.ts`
Expected: FAIL — `combineSharedRegistration` is not a function.

- [ ] **Step 3: Implement**

In `MasternodeService`:

```ts
async combineSharedRegistration(walletId: string, txHex: string, signatures: SharedRegistrationSignature[]): Promise<SharedRegistrationJoined> {
  const wallet = await requireWallet(this.walletDAO, walletId)
  const tx = Transaction.fromHex(txHex)
  const shares = sharedRegistrationShares(tx, wallet.network)
  sharedRegistrationCollateralDuffs(tx, shares)
  // index every signature, refuse duplicates and gaps
  // verify each recovers to its share owner with sharedRegistrationConsentSigner
  // set payload.joinSigs to the hex form in share order
  return {txHex: tx.hex(), consentHash: tx.consentHash()}
}
```

Constraints: the signature list must cover every share index exactly once; a base64 decode must be 65 bytes; recovery must equal `shares[index].ownerAddress`. Throw `Missing consent for share <index>`, `Duplicate consent for share <index>`, or `Consent for share <index> recovers to <address>, not <owner>`.

- [ ] **Step 4: Add handler, register, mirror preload**

Handler `CombineSharedMasternodeRegistrationHandler`; channel `combineSharedMasternodeRegistration`; preload returns `SharedRegistrationJoinedDTO`, and `definitions.ts` gains the matching invoke entry.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/api/sharedMasternodeCoordinator.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/src/types/Masternode.ts src/main/src/services/core/MasternodeService.ts src/main/src/api/masternodes/combineSharedMasternodeRegistration.ts src/main/src/WalletBackend.ts src/preload/index.d.ts tests/api/sharedMasternodeCoordinator.test.ts
git commit -m "feat: combine shared registration consents"
```

---

### Task 5: Assemble funding signatures and broadcast

**Files:**
- Modify: `src/main/src/types/Masternode.ts`
- Modify: `src/main/src/services/core/MasternodeService.ts`
- Modify: `src/main/src/utils/sharedMasternodeSigning.ts`
- Create: `src/main/src/api/masternodes/assembleSharedMasternodeRegistration.ts`
- Create: `src/main/src/api/masternodes/broadcastSharedMasternodeRegistration.ts`
- Modify: `src/main/src/WalletBackend.ts`
- Modify: `src/preload/index.d.ts`
- Test: `tests/api/sharedMasternodeCoordinator.test.ts`

**Interfaces:**
- Consumes: the joined transaction from Task 4, `SharedRegistrationFundingResult.signedHex`/`signedInputs` from the existing participant endpoint.
- Produces:
  - `SharedRegistrationContribution {signedHex: string; signedInputs: number[]}`
  - `SharedRegistrationFinal {txHex: string; proTxHash: string}`
  - `SharedRegistrationBroadcastResult {proTxHash: string; peersAcked: number}`
  - `requireSharedRegistrationConsents(tx: Transaction, shares: SharedRegistrationShare[], network: Network): void` — the per-share recovery check already inline in `signSharedRegistrationFunding`, extracted so funding, assemble and broadcast share it.
  - `MasternodeService.assembleSharedRegistration(walletId: string, txHex: string, contributions: SharedRegistrationContribution[]): Promise<SharedRegistrationFinal>`
  - `MasternodeService.broadcastSharedRegistration(walletId: string, txHex: string): Promise<SharedRegistrationBroadcastResult>`
  - IPC `assembleSharedMasternodeRegistration`, `broadcastSharedMasternodeRegistration`.

- [ ] **Step 1: Write the failing end-to-end test**

Continue the API test after combine:

```ts
it('assembles every member input, then broadcasts the final transaction', async () => {
  const plan = await masternodes.buildSharedRegistration(walletId, draft)
  const consent = await masternodes.signSharedRegistrationConsent(walletId, plan.txHex, PASSWORD)
  const joined = await masternodes.combineSharedRegistration(walletId, plan.txHex, consent.signatures)
  const funded = await masternodes.signSharedRegistrationFunding(walletId, joined.txHex, PASSWORD)
  const final = await masternodes.assembleSharedRegistration(walletId, joined.txHex, [
    {signedHex: funded.signedHex, signedInputs: funded.signedInputs},
  ])

  expect(Transaction.fromHex(final.txHex).inputs.every(i => i.scriptSig.hex() !== '')).toBe(true)
  expect(final.proTxHash).toBe(Transaction.fromHex(final.txHex).hash())

  const result = await masternodes.broadcastSharedRegistration(walletId, final.txHex)
  expect(result.proTxHash).toBe(final.proTxHash)
  expect(result.peersAcked).toBe(1)
})

it('refuses a contribution signed over a different transaction body', async () => {
  // take funded.signedHex, change an output amount, keep it parseable
})

it('refuses a final transaction with an unsigned input', async () => {
  // pass a contribution that omits one input
})
```

Stub `WalletSyncService.broadcastTransaction` in the harness to return `{txid: 'ff'.repeat(32), peersDelivered: ['1.2.3.4:9999']}` and record the hex it received.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/api/sharedMasternodeCoordinator.test.ts`
Expected: FAIL — `assembleSharedRegistration` is not a function.

- [ ] **Step 3: Extract the consent check**

Move the `findIndex` recovery loop out of `signSharedRegistrationFunding` into `requireSharedRegistrationConsents(tx, shares, network)` in `utils/sharedMasternodeSigning.ts`; it must keep the exact message `The registration has not collected share <n>'s consent yet`. Call the helper from funding (replacing the inline loop), assemble and broadcast. The existing `refuses to sign funding before every share owner consented` test must still pass unchanged.

- [ ] **Step 4: Implement assemble**

```ts
async assembleSharedRegistration(walletId: string, txHex: string, contributions: SharedRegistrationContribution[]): Promise<SharedRegistrationFinal> {
  const wallet = await requireWallet(this.walletDAO, walletId)
  const joined = Transaction.fromHex(txHex)
  const shares = sharedRegistrationShares(joined, wallet.network)
  sharedRegistrationCollateralDuffs(joined, shares)
  requireSharedRegistrationConsents(joined, shares, wallet.network)
  // for each contribution:
  //   parse signedHex; refuse unless withoutScriptSigs(signedHex) === withoutScriptSigs(txHex)
  //   for each index in signedInputs: require 0 <= index < inputs.length and a non-empty scriptSig
  //   copy that scriptSig into the joined transaction
  return {txHex: joined.hex(), proTxHash: joined.hash()}
}
```

The final result carries no fee: input values are not available here, and the build plan already reports `actualFeeDuffs`.

`withoutScriptSigs(hex)` parses, blanks every `scriptSig`, and returns `tx.hex()`. Put it in `utils/sharedMasternodeRegistration.ts` and unit-test it with a one-input transaction.

After merging, refuse unless every input has a non-empty scriptSig: `The registration is missing a funding signature for input <index>`. Then resolve each input's prevout through DAPI and verify its P2PKH SIGHASH_ALL signature against that output's key (`DESIGN.md` §5, *Funding*); a contribution that only produced a non-empty but wrong scriptSig must be refused with `The funding signature for input <index> is not valid`.

- [ ] **Step 5: Implement broadcast**

Parse the hex, `requireWallet` for the network, require a shared registration with all join signatures present and all input scriptSigs non-empty (reuse the same checks), then:

```ts
const broadcast = await this.walletSyncService.broadcastTransaction(tx.hex())
return {proTxHash: tx.hash(), peersAcked: broadcast.peersDelivered.length}
```

Do not re-sign or mutate the transaction.

- [ ] **Step 6: Add handlers, register, mirror preload**

Channels `assembleSharedMasternodeRegistration` and `broadcastSharedMasternodeRegistration`; preload DTOs for the contribution, the final transaction and the broadcast result, and the two matching entries in `definitions.ts`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/api/sharedMasternodeCoordinator.test.ts tests/api/sharedMasternodeSigning.test.ts tests/unit/sharedMasternodeSigning.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/src/types/Masternode.ts src/main/src/services/core/MasternodeService.ts src/main/src/utils/sharedMasternodeSigning.ts src/main/src/api/masternodes/assembleSharedMasternodeRegistration.ts src/main/src/api/masternodes/broadcastSharedMasternodeRegistration.ts src/main/src/WalletBackend.ts src/preload/index.d.ts src/main/src/utils/sharedMasternodeRegistration.ts tests/api/sharedMasternodeCoordinator.test.ts
git commit -m "feat: assemble and broadcast shared registrations"
```

---

### Task 6: Documentation and full gate

**Files:**
- Modify: `docs/superpowers/specs/2026-11-16-shared-masternodes-design.md` (record that creation is now implemented, and where)
- No renderer files.

- [ ] **Step 1: Run the full green gate**

Run, in order:

1. `npx tsc --noEmit -p tsconfig.node.json`
2. `npx tsc --noEmit -p tsconfig.web.json`
3. `npx tsc --noEmit -p tests/tsconfig.json`
4. `npx vitest run` — the whole suite, no failures
5. `npx electron-vite build` — no font `didn't resolve at build time` warning

- [ ] **Step 2: Stage and report**

Stage the touched files; report the gate output and the exact IPC surface added. Do not edit `src/renderer`.

---

## Self-Review Notes

- **Spec coverage:** creation (Tasks 1–3), consent combining (Task 4), funding assembly and broadcast (Task 5). Participant preview/consent/funding and discovery already exist.
- **Out of scope, deliberately:** solo/Evo registration at v3 (separate plan — payout model), `ProUpShareTx`, `ProDisTx`, `ProUpSharedRegTx`, renderer screens.
- **Type consistency:** the four new service methods and their IPC names are referenced identically in every task; `SharedRegistrationOutput` is reused from the participant preview work rather than redefined.
- **Known protocol limits this plan does not lift:** only P2PKH wallet inputs can be signed by `signSharedRegistrationFunding`; a member whose funding input is P2SH needs a different signing path.
