import {describe, expect, it} from 'vitest'
import {masternodeIdentityIds} from '../../src/main/src/utils/masternodeIdentities'

// Pinned against dash-platform-sdk's createMasternodeIdentityId and
// createVoterIdentityId: the owner identity is the proTxHash, the voter one
// sha256(proTxHash ‖ voting key hash160).
const PRO_TX_HASH = '5884221907e247d044102fbc3e20544b999ecbfc0fef3b4f8f4607da1f6f5abe'
const VOTING_ADDRESS = 'yPXEbJ9KHQ8j4ME3Rvw4AvaKviDwGGxobR'

describe('masternodeIdentityIds', () => {
  it('derives the owner and voter identities Platform creates for a node', () => {
    expect(masternodeIdentityIds(PRO_TX_HASH, VOTING_ADDRESS)).toEqual([
      {role: 'owner', identifier: '6xXjjA9wr4ZE1vBb7fd35UELmp27YS71hfyJ8rSUeRRP'},
      {role: 'voter', identifier: '6Kdco85wdf3WrT95QzNni9LK19K8hptq62CCXP8rxcea'},
    ])
  })
})