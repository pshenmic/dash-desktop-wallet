import {describe, it, expect} from 'vitest'
import {createSerializer} from '../../src/main/p2p/utils/serializer'

describe('createSerializer', () => {
  it('runs operations one at a time in call order', async () => {
    const serialize = createSerializer()
    const order: string[] = []
    const task = (name: string, ms: number) => serialize(async () => {
      order.push(`${name}:start`)
      await new Promise(resolve => setTimeout(resolve, ms))
      order.push(`${name}:end`)
      return name
    })

    const results = await Promise.all([task('a', 20), task('b', 5), task('c', 1)])

    expect(results).toEqual(['a', 'b', 'c'])
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
  })

  it('keeps the chain alive after a failure', async () => {
    const serialize = createSerializer()
    const failed = serialize(async () => {
      throw new Error('boom')
    })
    const after = serialize(async () => 'ok')

    await expect(failed).rejects.toThrow('boom')
    await expect(after).resolves.toBe('ok')
  })

  it('propagates each operation result to its own caller', async () => {
    const serialize = createSerializer()
    const [first, second] = await Promise.all([
      serialize(async () => 1),
      serialize(async () => 2),
    ])

    expect(first).toBe(1)
    expect(second).toBe(2)
  })
})
