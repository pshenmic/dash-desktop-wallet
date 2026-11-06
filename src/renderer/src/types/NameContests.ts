import type { ReactNode } from 'react'
import type { Network, UsernameDto } from '@renderer/api/types'
import type { ContestSegment, ContestStatus } from '@renderer/enums/Masternodes'

export interface NameContest extends UsernameDto {
  walletIdentifiers: string[]
}

export interface ContestTableRowProps {
  contest: NameContest
  now: number
  network: Network | undefined
  onOpen: (normalizedLabel: string) => void
}

export interface ContestLeader {
  label: string | null
  votes: number
  share: number
}

export interface ContestFilter {
  query: string
  segment: ContestSegment
  now: number
  network: Network | undefined
}

export interface ContestDisplayStatus {
  status: ContestStatus
  waitingForOutcome: boolean
}

export interface ContenderOptionProps {
  icon: ReactNode
  title: ReactNode
  badge?: ReactNode
  votes: number
  share: number
}

export interface ShareBarProps {
  share: number
  className?: string
}
