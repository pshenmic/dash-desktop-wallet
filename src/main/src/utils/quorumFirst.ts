// Shuffled, with the current validator set ahead of every other evonode: its
// members just executed a block, so they run the version the network does.
// A URL keeps an IPv6 host in brackets, which a validator's nodeIp has not.
export function quorumFirst(dapiUrls: string[], quorumHosts: Set<string>): string[] {
  const rank = new Map(dapiUrls.map(dapiUrl => {
    const host = new URL(dapiUrl).hostname.replace(/^\[(.*)\]$/, '$1')
    return [dapiUrl, (quorumHosts.has(host) ? 0 : 1) + Math.random()]
  }))
  return [...dapiUrls].sort((a, b) => rank.get(a)! - rank.get(b)!)
}
