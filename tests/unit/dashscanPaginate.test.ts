import {describe, it, expect, vi} from 'vitest'
import {paginate} from '../../src/main/src/providers/DashscanWalletProvider'
import {XPUB_PAGE_LIMIT, XPUB_MAX_PAGES} from '../../src/main/src/constants/dashscan'

describe('paginate', () => {
  it('collects until a short page', async () => {
    const fetchPage = vi.fn().mockResolvedValue({resultSet: [1, 2], pagination: {page: 1, limit: XPUB_PAGE_LIMIT, total: 2}})

    expect(await paginate(fetchPage)).toEqual([1, 2])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the page cap is hit without completing', async () => {
    const full = Array.from({length: XPUB_PAGE_LIMIT}, (_, i) => i)
    const fetchPage = vi.fn().mockResolvedValue({resultSet: full, pagination: {page: 1, limit: XPUB_PAGE_LIMIT, total: Number.MAX_SAFE_INTEGER}})

    await expect(paginate(fetchPage)).rejects.toThrow('page cap')
    expect(fetchPage).toHaveBeenCalledTimes(XPUB_MAX_PAGES)
  })
})