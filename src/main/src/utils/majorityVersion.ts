// An activated protocol version moves every synced node at once; nodes on another are behind.
export function majorityVersion(nodesByVersion: Map<number, string[]>): number | null {
  return [...nodesByVersion].reduce<[number | null, number]>(
    (majority, [version, nodes]) => nodes.length > majority[1] ? [version, nodes.length] : majority, [null, 0])[0]
}
