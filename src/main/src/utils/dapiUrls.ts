// null lets the SDK discover evonodes from its own seeds; [] means no urls yet.
export function resolveDapiUrls(mode: 'dynamic' | 'static', own: string[], pinned: string[] | null | undefined): string[] | null {
  if (mode === 'static' && own.length > 0) return own
  if (pinned === null) return null
  return pinned ?? []
}