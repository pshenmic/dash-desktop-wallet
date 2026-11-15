import {DIFFICULTY_WINDOW_DEPTH} from '../constants'
import {headerFields} from '../utils/pow'
import type {ChainStore} from './ChainStore'
import type {DifficultyBlock} from '../types/difficulty'

// The (time, nBits) chain the retarget rule reads. Far deeper than ChainWindow
// because KGW walks back KGW_PAST_BLOCKS_MAX, and a branch forking
// REORG_MAX_DEPTH under the tip still needs that much context from there. Its
// seed — blocks 0 and 1, which never arrive over the wire — is held below every
// floor, since the first interval retarget reads block 0's time.
export class DifficultyWindow {
  private readonly byHeight = new Map<number, DifficultyBlock>()
  private tipHeight = 0
  private floorHeight = 2

  at = (height: number): DifficultyBlock | undefined => this.byHeight.get(height)

  async load(chainStore: ChainStore, tipHeight: number, seed: DifficultyBlock[]): Promise<void> {
    this.tipHeight = tipHeight
    for (const block of seed) this.byHeight.set(block.height, block)

    const from = Math.max(2, tipHeight - DIFFICULTY_WINDOW_DEPTH)
    this.floorHeight = from
    for (const {height, raw} of await chainStore.iterateHeadersInRange(from, tipHeight)) {
      const fields = headerFields(raw)
      if (fields == null) continue
      this.byHeight.set(height, {height, time: fields.time, nBits: fields.nBits})
    }
  }

  record(block: DifficultyBlock): void {
    this.byHeight.set(block.height, block)
    if (block.height > this.tipHeight) this.tipHeight = block.height
    this.prune()
  }

  // Everything above the fork goes before the winning branch is validated, or
  // the orphaned nBits would still answer a lookup at those heights.
  rewindTo(height: number): void {
    for (const key of [...this.byHeight.keys()]) {
      if (key > height) this.byHeight.delete(key)
    }
    this.tipHeight = height
  }

  // Walks up from the last floor rather than over the map, so a commit stays
  // O(1) amortised against a window this deep.
  private prune(): void {
    const floor = this.tipHeight - DIFFICULTY_WINDOW_DEPTH
    for (let height = this.floorHeight; height < floor; height++) this.byHeight.delete(height)
    if (floor > this.floorHeight) this.floorHeight = floor
  }
}
