import type { MasternodeIdentityInfoDto } from '@renderer/api/types'
import { IDENTITIES_ROUTES, IDENTITIES_TABS, MASTERNODE_IDENTITIES_COPY } from '@renderer/constants/identities'
import type { MasternodeIdentityView } from '@renderer/types/Identities'
import { matchesIdentityQuery } from './dpnsLabel'
import { identityHref } from './identities'

export function groupMasternodeIdentities(entries: MasternodeIdentityInfoDto[]): MasternodeIdentityView[] {
  const byIdentifier = new Map<string, MasternodeIdentityView>()
  for (const entry of entries) {
    const existing = byIdentifier.get(entry.identifier)
    if (existing == null) {
      byIdentifier.set(entry.identifier, {
        identity: {
          identityIndex: -1,
          identifier: entry.identifier,
          usernames: [...entry.usernames],
          keys: [...entry.keys],
          balance: entry.balance,
          derivationPath: '',
          assetLockTxid: null,
        },
        bindings: [{ proTxHash: entry.proTxHash, role: entry.role }],
      })
      continue
    }

    const hasBinding = existing.bindings.some(
      binding => binding.proTxHash === entry.proTxHash && binding.role === entry.role,
    )
    if (!hasBinding) {
      existing.bindings.push({ proTxHash: entry.proTxHash, role: entry.role })
    }
    for (const username of entry.usernames) {
      if (!existing.identity.usernames.includes(username)) {
        existing.identity.usernames.push(username)
      }
    }
    if (existing.identity.keys.length === 0 && entry.keys.length > 0) {
      existing.identity.keys = [...entry.keys]
    }
    if (entry.balance.amount > existing.identity.balance.amount) {
      existing.identity.balance = entry.balance
    }
  }
  return Array.from(byIdentifier.values())
}

export function masternodeIdentityHref(identifier: string): string {
  return `${identityHref(identifier)}?${IDENTITIES_TABS.sourceParam}=${IDENTITIES_TABS.masternodeSource}`
}

export function masternodeIdentitiesTabHref(): string {
  return `${IDENTITIES_ROUTES.root}?${IDENTITIES_TABS.param}=${IDENTITIES_TABS.masternodeIdentities}`
}

export function matchesMasternodeIdentityQuery(
  view: MasternodeIdentityView,
  votingNames: string[],
  query: string,
): boolean {
  if (matchesIdentityQuery(view.identity.identifier, [...view.identity.usernames, ...votingNames], query)) {
    return true
  }
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return view.bindings.some(binding => (
    binding.proTxHash.toLowerCase().includes(needle)
    || MASTERNODE_IDENTITIES_COPY.roleLabels[binding.role].toLowerCase().includes(needle)
  ))
}
