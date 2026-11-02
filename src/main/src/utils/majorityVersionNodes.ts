// An activated protocol version moves every synced node at once; nodes on another are behind.
export function majorityVersionNodes(nodesByVersion: Map<number, string[]>): string[] {
  return [...nodesByVersion.values()].reduce((majority, nodes) => nodes.length > majority.length ? nodes : majority, [])
}
