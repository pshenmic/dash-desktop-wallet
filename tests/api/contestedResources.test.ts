import {beforeEach, describe, expect, it, vi} from 'vitest'
import {ContestedResourceService} from '../../src/main/src/services/platform/ContestedResourceService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const RESOURCE = {
  contractId: 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec',
  documentTypeName: 'domain',
  indexName: 'parentNameAndLabel',
  indexValues: ['EgRkYXNo', 'EgNvd2w='],
  endsAt: 5_000,
  vote: {contenders: [{identifier: 'winner', votes: 4}], lockVotes: 0, abstainVotes: 0, outcome: null, winner: null},
}

describe('reading contested resources', () => {
  let service: ContestedResourceService
  let request: ReturnType<typeof vi.fn>
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    request = wired.request
    service = new ContestedResourceService(wired.walletDAO, {request} as unknown as PlatformWorkerService)
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
  })

  it('asks Platform for the polls still open on the wallet network', async () => {
    request.mockResolvedValue({resources: [RESOURCE]})

    expect(await service.getContestedResources(walletId)).toEqual([RESOURCE])
    expect(request).toHaveBeenCalledWith('contestedResources', 'testnet', {})
  })
})