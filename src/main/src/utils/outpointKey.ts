// A null part (coinbase input, unregistered collateral) keys as the string "null".
export function outpointKey(txid: string | null, vout: number | null): string {
  return `${txid}:${vout}`
}