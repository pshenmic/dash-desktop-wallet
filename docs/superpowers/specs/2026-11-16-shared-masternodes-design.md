# Shared masternodes — discovery and display

Approved 2026-11-16. Branch `feat/masternodes`, backend only (`src/main` +
`src/preload`); the renderer DTO mirror and screens are the frontend dev's gap.

## Intent

Dash Core v24 shared masternodes (spec: `dash-trustless-staking/DESIGN.md`,
live-verified on testnet 2026-11-16) split the 1000-DASH collateral into 2–8
shares. The wallet must display them (`isShared` + share table) and
auto-discover the ones it holds a share of, exactly like regular masternodes
today — no import or manual step.

A shared ProRegTx (payload v3, Regular only) has a **null top-level owner key,
empty payouts**, and a share table `{amount, keyIDOwner, scriptRefund,
scriptReward}`. The collateral is the ProRegTx's own output paying the `DSHC`
template (`04445348437551`), spendable only by a ProDisTx. Rewards are split pro
rata to each share's reward script. The share's `keyIDOwner` is the only
ownership credential — today's two detection paths (1000/4000-DASH collateral
UTXOs, owner/voting/operator key walks matched on the top-level fields) can
never hit it.

## Goals

- p2p: the ProRegTx registration index reads the share table; owner-chain
  matching also matches share owner addresses, so the existing gap walk
  auto-discovers shared nodes we hold a share of (derived or imported key).
- `isShared: boolean | null` and `shares: {ownerAddress, amountDuffs}[] | null`
  on `NetworkMasternode`; null until the registration is indexed — the existing
  convention for ProRegTx-derived fields. `Masternode` marks our shares with
  `keyIndex: number | null` / `imported: boolean`, mirroring
  `ownerKeyIndex`/`importedRoles`.
- rpc: `isShared` detected from Dashscan's comma-joined owner list (shared nodes
  serve `ownerAddress`/`payee` as lists, `collateralAddress: "UNKNOWN"`);
  `shares: null` — Dashscan serves no amounts.
- Preload `MasternodeDTO` mirrored.

## Non-goals

Consent/funding signing (`sharedmn-consent`/`sharedmn-fund`), dissolve
(ProDisTx), ProUpShareTx/ProUpSharedRegTx handling, refund/reward script
display, renderer changes, Dashscan share-filter support (separate project).

## Constraints

- p2p reads only the network — Dashscan is rpc-mode only.
- chain.db registrations are JSON: share amounts stored as `number` there
  (≤ 1e11 duffs, safe integer), `bigint` from `listedMasternode` out; bigint
  crosses the utility-process port as itself.
- Old chain.db rows re-index once via the existing layout filter in
  `ProviderRegistry.load` (the `payouts`-array check gains a `shares` check).
- Collateral flow unchanged: a shared node's stored outpoint is the DSHC
  output, never a wallet coin, so locking it is inert; its payout watch finds
  nothing (payouts are immutable). No new IPC endpoint, no SQLite migration.

## Approaches

1. **Chosen — extend the registration index + owner matching.** One code path,
   reuses the gap walk, no new scans; works offline from chain.db.
2. Match refund/reward script addresses — rejected: weaker ownership credential
   (scripts must not pay owner keys, but ownership is the owner key), needs the
   full address set against every registration.
3. rpc-first via Dashscan — rejected: the deployed `owner_address` filter
   matches the whole comma-joined string, so a single share owner returns
   nothing (live-verified); p2p is the main mode.

## rpc-mode gap (stated, not fixed here)

Member shares are not discoverable in rpc mode until Dashscan filters inside
the owner list; only creator voting/operator keys surface shared nodes there,
without amounts. p2p covers the member case fully.

## Builder's latitude

Helper/type names, test fixture construction (synthetic shared ProRegTx built
with the local SDK, values shaped from the live testnet registration
`58842219…0d05b`), exact comment wording.
