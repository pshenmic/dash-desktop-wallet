// A protocol version moves only at an epoch boundary. Its time is an estimate, so
// the gap either side of it is polled, and the rest of the epoch is checked idly.
export function versionCheckDelay(now: number, boundary: number, gap: number, poll: number, idle: number): number {
  if (now < boundary - gap) return Math.min(idle, boundary - gap - now)
  return now <= boundary + gap ? poll : idle
}
