// Callers arriving while a run is in flight share its outcome rather than
// starting a second one; the entry drops itself once the run settles.
export function joinInFlight<T>(inFlight: Map<string, Promise<T>>, key: string, work: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key)
  if (existing != null) return existing

  const run = work().finally(() => inFlight.delete(key))
  inFlight.set(key, run)
  return run
}

// One run per key at a time, in arrival order. A failed run does not wedge the
// key, and the queue drops itself once the last run settles so the map does not
// grow with every key ever used.
export function serializeByKey<T>(queues: Map<string, Promise<unknown>>, key: string, work: () => Promise<T>): Promise<T> {
  const prior = queues.get(key) ?? Promise.resolve()
  const run = prior.catch(() => undefined).then(work)
  queues.set(key, run)
  return run.finally(() => {
    if (queues.get(key) === run) queues.delete(key)
  })
}
