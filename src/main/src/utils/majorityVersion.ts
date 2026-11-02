// An activated protocol version moves every synced node at once; nodes on another are behind.
export function majorityVersion(nodesByVersion: Map<number, string[]>): [number, string[]] | undefined {
  return [...nodesByVersion].reduce<[number, string[]] | undefined>(
    (majority, entry) => entry[1].length > (majority?.[1].length ?? 0) ? entry : majority, undefined)
}
