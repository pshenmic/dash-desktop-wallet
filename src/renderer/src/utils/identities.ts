import type { IdentityKeyDto, UsernameDto } from '@renderer/api/types'
import { IDENTITIES_ROUTES, IDENTITY_ROUTE_PARAM } from '@renderer/constants/identities'
import { UsernamePresentation } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import { normalizeDpnsLabel, stripDpnsInput } from './dpnsLabel'
import { mergeIdentityUsernames } from './usernames'

export function identityHref(identifier: string): string {
  return IDENTITIES_ROUTES.identity.replace(IDENTITY_ROUTE_PARAM, encodeURIComponent(identifier))
}

export function identityAddKeysHref(identifier: string): string {
  return IDENTITIES_ROUTES.addKeys.replace(IDENTITY_ROUTE_PARAM, encodeURIComponent(identifier))
}

export function isIdentityKeyActive(key: Pick<IdentityKeyDto, 'disabledAt'>): boolean {
  return key.disabledAt == null
}

export function activeKeysCount(keys: IdentityKeyDto[]): number {
  return keys.filter(isIdentityKeyActive).length
}

export function identityVotingNames(identity: Pick<IdentityApiDto, 'identifier' | 'usernames'>, usernames: UsernameDto[]): string[] {
  const registered = new Set(identity.usernames.map(name => normalizeDpnsLabel(stripDpnsInput(name))))
  return mergeIdentityUsernames(identity.usernames, usernames, identity.identifier)
    .filter(row => row.presentation === UsernamePresentation.Voting && !registered.has(row.normalizedLabel))
    .map(row => row.fullName)
}
