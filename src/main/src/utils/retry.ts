export async function retry<T>(work: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await work()
    } catch (err) {
      lastError = err
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}
