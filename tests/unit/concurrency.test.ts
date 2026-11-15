import {describe, it, expect, vi} from 'vitest'
import {joinInFlight, serializeByKey} from '../../src/main/src/utils/concurrency'

describe('joinInFlight', () => {
  it('shares one run between callers that arrive while it is in flight', async () => {
    const inFlight = new Map<string, Promise<number>>()
    let runs = 0
    let release!: (value: number) => void
    const work = (): Promise<number> => {
      runs++
      return new Promise(resolve => { release = resolve })
    }

    const first = joinInFlight(inFlight, 'w', work)
    const second = joinInFlight(inFlight, 'w', work)
    release(7)

    expect(await first).toBe(7)
    expect(await second).toBe(7)
    expect(runs).toBe(1)
  })

  it('starts a fresh run once the previous one settled', async () => {
    const inFlight = new Map<string, Promise<number>>()
    let runs = 0
    const work = async (): Promise<number> => ++runs

    expect(await joinInFlight(inFlight, 'w', work)).toBe(1)
    expect(await joinInFlight(inFlight, 'w', work)).toBe(2)
    expect(inFlight.size).toBe(0)
  })

  it('does not wedge the key on a failed run', async () => {
    const inFlight = new Map<string, Promise<number>>()
    const failing = (): Promise<number> => Promise.reject(new Error('boom'))

    await expect(joinInFlight(inFlight, 'w', failing)).rejects.toThrow('boom')
    expect(inFlight.size).toBe(0)
    expect(await joinInFlight(inFlight, 'w', async () => 3)).toBe(3)
  })

  it('keeps keys apart', async () => {
    const inFlight = new Map<string, Promise<string>>()
    let release!: () => void
    const a = joinInFlight(inFlight, 'a', () => new Promise(resolve => { release = () => resolve('a') }))
    const b = joinInFlight(inFlight, 'b', async () => 'b')

    expect(await b).toBe('b')
    release()
    expect(await a).toBe('a')
  })
})

describe('serializeByKey', () => {
  it('runs work for one key in arrival order', async () => {
    const queues = new Map<string, Promise<unknown>>()
    const order: number[] = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })

    const first = serializeByKey(queues, 'w', async () => {
      order.push(1)
      await gate
    })
    const second = serializeByKey(queues, 'w', async () => { order.push(2) })

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(order).toEqual([1])
    release()
    await Promise.all([first, second])
    expect(order).toEqual([1, 2])
  })

  it('does not let a failed run block the next one', async () => {
    const queues = new Map<string, Promise<unknown>>()
    const first = serializeByKey(queues, 'w', () => Promise.reject(new Error('boom')))
    const second = serializeByKey(queues, 'w', async () => 'ok')

    await expect(first).rejects.toThrow('boom')
    expect(await second).toBe('ok')
  })

  it('drops the queue once the last run settles', async () => {
    const queues = new Map<string, Promise<unknown>>()
    await serializeByKey(queues, 'w', async () => 1)
    expect(queues.size).toBe(0)

    const first = serializeByKey(queues, 'w', async () => 1)
    const second = serializeByKey(queues, 'w', async () => 2)
    await Promise.all([first, second])
    expect(queues.size).toBe(0)
  })

  it('keeps keys apart', async () => {
    const queues = new Map<string, Promise<unknown>>()
    const order: string[] = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })

    const a = serializeByKey(queues, 'a', async () => { await gate; order.push('a') })
    const b = serializeByKey(queues, 'b', async () => { order.push('b') })

    await b
    expect(order).toEqual(['b'])
    release()
    await a
    expect(order).toEqual(['b', 'a'])
  })

  it('returns the work’s own resolution', async () => {
    const queues = new Map<string, Promise<unknown>>()
    expect(await serializeByKey(queues, 'w', async () => 42)).toBe(42)
  })
})

describe('serializeByKey timing', () => {
  it('starts the next run only after the previous one settles', async () => {
    vi.useFakeTimers()
    try {
      const queues = new Map<string, Promise<unknown>>()
      const starts: number[] = []
      const slow = serializeByKey(queues, 'w', () => new Promise(resolve => {
        starts.push(Date.now())
        setTimeout(resolve, 100)
      }))
      const fast = serializeByKey(queues, 'w', async () => { starts.push(Date.now()) })

      await vi.advanceTimersByTimeAsync(50)
      expect(starts).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(50)
      await Promise.all([slow, fast])
      expect(starts).toHaveLength(2)
      expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(100)
    } finally {
      vi.useRealTimers()
    }
  })
})
