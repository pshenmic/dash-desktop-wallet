import { describe, expect, it } from 'vitest'
import type { MasternodeIdentityInfoDto } from '@renderer/api/types'
import {
  groupMasternodeIdentities,
  masternodeIdentitiesTabHref,
  masternodeIdentityHref,
  matchesMasternodeIdentityQuery,
} from '@renderer/utils/masternodeIdentityView'

function makeEntry(overrides: Partial<MasternodeIdentityInfoDto> = {}): MasternodeIdentityInfoDto {
  return {
    proTxHash: 'aa'.repeat(32),
    role: 'owner',
    identifier: 'id1234567890abcdef',
    usernames: ['alice.dash'],
    keys: [],
    balance: { amount: 1_000_000n, usdAmount: '0.01' },
    ...overrides,
  }
}

describe('masternodeIdentityView', () => {
  it('groups duplicate identity identifiers and preserves all ProTxHash and role bindings', () => {
    const ownerEntry = makeEntry({ proTxHash: '11'.repeat(32), role: 'owner' })
    const voterEntry = makeEntry({ proTxHash: '22'.repeat(32), role: 'voter', usernames: ['mn-voter.dash'] })
    const distinct = makeEntry({ identifier: 'otherId999', proTxHash: '33'.repeat(32), role: 'voter', usernames: [] })

    const views = groupMasternodeIdentities([ownerEntry, voterEntry, ownerEntry, distinct])
    expect(views).toHaveLength(2)
    expect(views[0].identity.identifier).toBe('id1234567890abcdef')
    expect(views[0].identity.usernames).toEqual(['alice.dash', 'mn-voter.dash'])
    expect(views[0].identity.identityIndex).toBe(-1)
    expect(views[0].bindings).toEqual([
      { proTxHash: '11'.repeat(32), role: 'owner' },
      { proTxHash: '22'.repeat(32), role: 'voter' },
    ])
    expect(views[1].bindings).toEqual([{ proTxHash: '33'.repeat(32), role: 'voter' }])
  })

  it('builds detail and back navigation URLs scoped to masternode identities', () => {
    expect(masternodeIdentityHref('id123')).toBe('/identities/id123?source=masternode')
    expect(masternodeIdentitiesTabHref()).toBe('/identities?tab=masternode-identities')
  })

  it('filters masternode identities by username, identifier, role label, and ProTxHash', () => {
    const [view] = groupMasternodeIdentities([makeEntry({ proTxHash: 'cafe'.repeat(16), role: 'voter' })])
    expect(matchesMasternodeIdentityQuery(view, ['voting.dash'], 'alice')).toBe(true)
    expect(matchesMasternodeIdentityQuery(view, ['voting.dash'], 'voting')).toBe(true)
    expect(matchesMasternodeIdentityQuery(view, [], 'cafecafe')).toBe(true)
    expect(matchesMasternodeIdentityQuery(view, [], 'Voting')).toBe(true)
    expect(matchesMasternodeIdentityQuery(view, [], 'nonexistent')).toBe(false)
  })
})
