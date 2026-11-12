import { API } from '@renderer/api'
import type { ProposalDto, ProposalTally } from '@renderer/api/types'
import {
  GOVERNANCE_LOAD_ERROR,
  GOVERNANCE_PROPOSALS_NAMESPACE,
  GOVERNANCE_REFRESH_MS,
  GOVERNANCE_TALLY_ERROR,
  GOVERNANCE_TALLY_NAMESPACE,
} from '@renderer/constants/governanceProposals'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

function tallyCacheKey(walletId: string, proposalHash: string): string {
  return `${walletId}:${proposalHash}`
}

export function useGovernanceProposals(walletId: string) {
  const { data, loading, err } = useAsyncWithCache<ProposalDto[] | null>(
    GOVERNANCE_PROPOSALS_NAMESPACE,
    walletId,
    () => API.getGovernanceProposals(walletId),
    null,
    { errorMessage: GOVERNANCE_LOAD_ERROR, refreshIntervalMs: GOVERNANCE_REFRESH_MS },
  )
  return {
    proposals: data ?? [],
    ready: data !== null,
    loading,
    err,
    retry: () => { void refreshGovernanceProposals(walletId) },
  }
}

export function useProposalTally(walletId: string, proposalHash: string) {
  const key = tallyCacheKey(walletId, proposalHash)
  const { data, loading, err } = useAsyncWithCache<ProposalTally | null>(
    GOVERNANCE_TALLY_NAMESPACE,
    key,
    () => API.getProposalTally(walletId, proposalHash),
    null,
    { errorMessage: GOVERNANCE_TALLY_ERROR, refreshIntervalMs: GOVERNANCE_REFRESH_MS },
  )
  return {
    tally: data,
    loading,
    err,
    retry: () => { void refreshProposalTally(walletId, proposalHash) },
  }
}

export async function refreshGovernanceProposals(walletId: string): Promise<void> {
  try {
    await API.refreshGovernance(walletId)
  } finally {
    invalidateAsyncCache(GOVERNANCE_PROPOSALS_NAMESPACE, walletId)
    await prefetchAsyncCache(GOVERNANCE_PROPOSALS_NAMESPACE, walletId, () => API.getGovernanceProposals(walletId))
  }
}

export async function refreshProposalTally(walletId: string, proposalHash: string): Promise<void> {
  const key = tallyCacheKey(walletId, proposalHash)
  try {
    await API.refreshGovernance(walletId, proposalHash)
  } finally {
    invalidateAsyncCache(GOVERNANCE_TALLY_NAMESPACE, key)
    await prefetchAsyncCache(GOVERNANCE_TALLY_NAMESPACE, key, () => API.getProposalTally(walletId, proposalHash))
  }
}
