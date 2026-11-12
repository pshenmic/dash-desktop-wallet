import {Message, MessageOptions, Messages} from 'dash-core-p2p'
import type {GovernanceMessages} from '../types/governance'
import type {PoolService} from './PoolService'

// dash-core-p2p drops these three commands unparsed. Their payloads stay raw:
// sync/governance reads them with the shared governance helpers.
class GovernancePayloadMessage extends Message {
  payload: Uint8Array

  constructor(arg: {payload?: Uint8Array} | undefined, options: MessageOptions) {
    super(options)
    this.payload = arg?.payload ?? new Uint8Array(0)
  }

  setPayload(payload: Uint8Array): void {
    this.payload = Uint8Array.from(payload)
  }

  getPayload(): Uint8Array {
    return this.payload
  }
}

// Messages.add types the options as a bare object; the builder passes its own.
function command(name: string): new (arg: unknown, options: object) => Message {
  return class extends GovernancePayloadMessage {
    constructor(arg: unknown, options: object) {
      super(arg as {payload?: Uint8Array} | undefined, {...options, command: name})
    }
  }
}

export function addGovernanceMessages(messages: Messages): void {
  messages.add('govsync', 'GovSync', command('govsync'))
  messages.add('govobj', 'GovObj', command('govobj'))
  messages.add('govobjvote', 'GovObjVote', command('govobjvote'))
}

// `pool.messages` typed with the factories registered above.
export function governanceMessages(pool: PoolService): GovernanceMessages {
  return pool.messages as unknown as GovernanceMessages
}
