// Shuffled, with the current validator set ahead of every other evonode: its
// members just executed a block, so they run the version the network does.
export function quorumFirst(dapiUrls: string[], quorumHosts: Set<string>): string[] {
  const rank = new Map(dapiUrls.map(dapiUrl => [dapiUrl, (quorumHosts.has(new URL(dapiUrl).hostname) ? 0 : 1) + Math.random()]))
  return [...dapiUrls].sort((a, b) => rank.get(a)! - rank.get(b)!)
}
