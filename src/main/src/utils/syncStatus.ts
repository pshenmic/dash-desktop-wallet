import {WalletSyncStatus} from '../../p2p/types/walletSync'

export function stoppedSyncStatus(): WalletSyncStatus {
  return {
    phase: 'stopped',
    network: null,
    walletId: null,
    tipHeight: 0,
    tipHash: null,
    estimatedChainHeight: 0,
    cfheadersHeight: 0,
    cfilterScanHeight: 0,
    matchedBlocksPending: 0,
    peerCount: 0,
    filterCapablePeerCount: 0,
    lockPeerCount: 0,
    peerMode: null,
    phaseEtaMs: null,
    lastError: null,
    updatedAt: Date.now(),
  }
}