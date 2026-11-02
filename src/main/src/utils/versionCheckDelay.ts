// A protocol version moves only when an epoch starts, which is its scheduled
// time or, at most `lag` later, the first block after it.
export function inEpochStartWindow(now: number, epochStart: number, lag: number): boolean {
  return now >= epochStart && now <= epochStart + lag
}

export function versionCheckDelay(now: number, epochStart: number, lag: number, poll: number, idle: number): number {
  if (now < epochStart) return Math.min(idle, epochStart - now)
  return inEpochStartWindow(now, epochStart, lag) ? poll : idle
}
