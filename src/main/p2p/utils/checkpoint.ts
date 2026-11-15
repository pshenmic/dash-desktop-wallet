import {CF_CHECKPOINT_INTERVAL} from '../constants'

export function checkpointAtOrBelow(height: number): number {
  return Math.floor(height / CF_CHECKPOINT_INTERVAL) * CF_CHECKPOINT_INTERVAL
}

export function nextCheckpointAbove(height: number): number {
  return checkpointAtOrBelow(height) + CF_CHECKPOINT_INTERVAL
}
