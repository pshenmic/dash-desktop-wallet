import { useCallback, useEffect, useState } from 'react'
import { MASTERNODE_VIEW_MODE_STORAGE_KEY } from '@renderer/constants/masternodeNodes'
import { MasternodeViewMode } from '@renderer/enums/Masternodes'
import { parseMasternodeViewMode } from '@renderer/utils/masternodeNodes'

const listeners = new Set<(mode: MasternodeViewMode) => void>()

function readViewMode(): MasternodeViewMode {
  try {
    return parseMasternodeViewMode(localStorage.getItem(MASTERNODE_VIEW_MODE_STORAGE_KEY))
  } catch {
    return MasternodeViewMode.Cards
  }
}

function writeViewMode(mode: MasternodeViewMode): void {
  try {
    localStorage.setItem(MASTERNODE_VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    return
  }
}

export function useMasternodeViewMode(): readonly [
  MasternodeViewMode,
  (next: MasternodeViewMode) => void,
] {
  const [viewMode, setViewModeState] = useState<MasternodeViewMode>(readViewMode)

  useEffect(() => {
    listeners.add(setViewModeState)
    setViewModeState(readViewMode())
    return () => {
      listeners.delete(setViewModeState)
    }
  }, [])

  const setViewMode = useCallback((next: MasternodeViewMode) => {
    const parsed = parseMasternodeViewMode(next)
    writeViewMode(parsed)
    setViewModeState(parsed)
    for (const listener of listeners) {
      if (listener !== setViewModeState) listener(parsed)
    }
  }, [])

  return [viewMode, setViewMode] as const
}
