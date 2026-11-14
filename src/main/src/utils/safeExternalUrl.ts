// Only http(s) may reach the OS handler; file:, javascript: and custom
// protocols from network-sourced content must not launch external apps.
export function isSafeExternalUrl(url: string): boolean {
  try {
    const {protocol} = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}