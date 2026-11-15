import {describe, it, expect, vi} from 'vitest'
import {retry} from '../../src/main/src/utils/retry'

describe('retry', () => {
  it('returns the first success without retrying', async () => {
    const work = vi.fn(async () => 'ok')
    expect(await retry(work, 3, 0)).toBe('ok')
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('retries until one attempt lands', async () => {
    let attempts = 0
    const result = await retry(async () => {
      attempts++
      if (attempts < 3) throw new Error('transient')
      return attempts
    }, 5, 0)

    expect(result).toBe(3)
  })

  it('throws the last error once the attempts run out', async () => {
    const work = vi.fn(async () => { throw new Error(`fail ${work.mock.calls.length}`) })
    await expect(retry(work, 3, 0)).rejects.toThrow('fail 3')
    expect(work).toHaveBeenCalledTimes(3)
  })

  it('waits between attempts but not after the last one', async () => {
    vi.useFakeTimers()
    try {
      const work = vi.fn(async () => { throw new Error('down') })
      const run = retry(work, 3, 100)
      const assertion = expect(run).rejects.toThrow('down')

      await vi.advanceTimersByTimeAsync(0)
      expect(work).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(100)
      expect(work).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(100)
      expect(work).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(1000)
      expect(work).toHaveBeenCalledTimes(3)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
