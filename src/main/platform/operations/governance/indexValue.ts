const TEXT = 0x12

// A vote poll encodes each index value as a bincode value. A text value is its
// tag, a one-byte length, then UTF-8, which is the form every DPNS index takes.
export function textIndexValue(encoded: Uint8Array): string | null {
  if (encoded[0] !== TEXT || encoded[1] !== encoded.length - 2) return null
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(encoded.slice(2))
  } catch {
    return null
  }
}