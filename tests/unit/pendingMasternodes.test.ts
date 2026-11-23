import { describe, expect, it } from 'vitest'
import type { MasternodeDto } from '@renderer/api/types'
import { PENDING_MASTERNODE_TTL_MS, REGISTERING_MASTERNODE_STATUS } from '@renderer/constants/masternodes'
import type { PendingMasternodeEntry } from '@renderer/types/PendingMasternode'
import {
  activePendingMasternodes,
  mergePendingMasternodes,
  pendingMasternodeToDto,
} from '@renderer/utils/pendingMasternodes'

const baseEntry: PendingMasternodeEntry = {
  proTxHash: '11'.repeat(32),
  type: 'Regular',
  collateralTxid: '22'.repeat(32),
  collateralVout: 0,
  collateralAddress: 'yCollateral',
  serviceAddress: '45.67.89.10:19999',
  payeeAddress: 'yPayee',
  ownerAddress: null,
  votingAddress: null,
  operatorPublicKey: null,
  platformNodeId: null,
  platformP2PPort: null,
  platformHttpPort: null,
  createdAt: 1_000_000,
}

describe('pendingMasternodes', () => {
  it('converts a pending registration entry to a REGISTERING MasternodeDto', () => {
    const dto = pendingMasternodeToDto(baseEntry)
    expect(dto.proTxHash).toBe(baseEntry.proTxHash)
    expect(dto.status).toBe(REGISTERING_MASTERNODE_STATUS)
    expect(dto.serviceAddress).toBe('45.67.89.10:19999')
    expect(dto.payeeAddress).toBe('yPayee')
    expect(dto.isShared).toBe(false)
    expect(dto.ownerKeyIndex).toBeNull()
    expect(dto.importedSigningRoles).toEqual([])
  })

  it('drops pending entries once discovered on the backend or after TTL expires', () => {
    const expired: PendingMasternodeEntry = { ...baseEntry, proTxHash: '33'.repeat(32), createdAt: 1_000_000 }
    const fresh: PendingMasternodeEntry = { ...baseEntry, proTxHash: '44'.repeat(32), createdAt: 1_000_000 + PENDING_MASTERNODE_TTL_MS - 1_000 }
    const discovered: PendingMasternodeEntry = { ...baseEntry, proTxHash: '55'.repeat(32), createdAt: 1_000_000 + PENDING_MASTERNODE_TTL_MS - 500 }

    const now = 1_000_000 + PENDING_MASTERNODE_TTL_MS
    const backend: MasternodeDto[] = [{
      ...pendingMasternodeToDto(discovered),
      status: 'ENABLED',
      ownerKeyIndex: 0,
    }]

    const remaining = activePendingMasternodes([expired, fresh, discovered], backend, now)
    expect(remaining.map(item => item.proTxHash)).toEqual([fresh.proTxHash])

    const merged = mergePendingMasternodes(backend, [expired, fresh, discovered], now)
    expect(merged.map(node => [node.proTxHash, node.status])).toEqual([
      [fresh.proTxHash, REGISTERING_MASTERNODE_STATUS],
      [discovered.proTxHash, 'ENABLED'],
    ])
  })
})
