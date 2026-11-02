import {createClient} from 'dash-platform-sdk'
import status from 'dash-platform-sdk/src/node/status.js'
import getCurrentQuorumsInfo from 'dash-platform-sdk/src/node/getCurrentQuorumsInfo.js'
import {Network} from '../../src/types/Network'
import {DAPI_MAX_BLOCK_AGE_MS, DAPI_PROBE_BATCH, DAPI_STATUS_TIMEOUT_MS} from '../constants'
import {DapiUrlStatus} from '../types/messages'
import {Logger} from '../../src/utils/logger'
import {quorumFirst} from '../../src/utils/quorumFirst'

const log = new Logger('platform')

// Answering candidates by the protocol version they run, probed one batch at a
// time, quorum first and shuffled; `afterBatch` stops it by answering true.
export async function dapiUrlsByProtocolVersion(
  candidates: string[],
  network: Network,
  afterBatch: (byVersion: Map<number, string[]>) => boolean,
): Promise<Map<number, string[]>> {
  const shuffled = quorumFirst(candidates, await quorumHosts(candidates, network))
  const byVersion = new Map<number, string[]>()
  for (let start = 0; start < shuffled.length; start += DAPI_PROBE_BATCH) {
    await Promise.all(shuffled.slice(start, start + DAPI_PROBE_BATCH).map(async dapiUrl => {
      const {error, pingMs, protocolVersion} = await probeDapiUrl(dapiUrl, network)
      log.debug(`probe ${dapiUrl}: ${error ?? `${pingMs}ms, protocol ${protocolVersion}`}`)
      if (error != null || protocolVersion == null) return
      byVersion.set(protocolVersion, [...byVersion.get(protocolVersion) ?? [], dapiUrl])
    }))
    if (afterBatch(byVersion)) break
  }
  return byVersion
}

// Asked of one random candidate; without an answer every evonode ranks alike.
async function quorumHosts(candidates: string[], network: Network): Promise<Set<string>> {
  const asked = candidates[Math.floor(Math.random() * candidates.length)]
  if (asked == null) return new Set()
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), DAPI_STATUS_TIMEOUT_MS)
  try {
    const {currentQuorumHash, validatorSets} = await getCurrentQuorumsInfo({network, getClient: () => createClient(asked, abortController)})
    const current = validatorSets.find(validatorSet => validatorSet.quorumHash === currentQuorumHash)
    return new Set(current?.members.filter(member => !member.isBanned).map(member => member.nodeIp))
  } catch (err) {
    log.debug(`quorum from ${asked}: ${err instanceof Error ? err.message : String(err)}`)
    return new Set()
  } finally {
    clearTimeout(timer)
  }
}

export function probeActiveDapiUrls(dapiUrls: string[], network: Network): Promise<DapiUrlStatus[]> {
  return Promise.all(dapiUrls.map(dapiUrl => probeDapiUrl(dapiUrl, network)))
}

// Every failure answers rather than rejecting: a caller waiting on the IPC
// reply would otherwise sit out its own timeout for an error already known.
export async function probeDapiUrl(dapiUrl: string, network: Network): Promise<DapiUrlStatus> {
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), DAPI_STATUS_TIMEOUT_MS)
  const started = performance.now()
  try {
    const nodeStatus = await status({network, getClient: () => createClient(dapiUrl, abortController)})
    // The SDK health-checks only nodes it discovers, never a url list it is handed.
    // time.local is in seconds, time.block in milliseconds.
    const blockAgeMs = Number(nodeStatus.time?.local) * 1000 - Number(nodeStatus.time?.block)
    const issue = nodeStatus.chain == null || nodeStatus.chain.catchingUp
      ? 'still syncing'
      : blockAgeMs <= DAPI_MAX_BLOCK_AGE_MS ? null : 'chain stalled: no recent block'
    return {
      dapiUrl,
      proTxHash: nodeStatus.node?.proTxHash ?? null,
      pingMs: Math.round(performance.now() - started),
      driveVersion: nodeStatus.version?.software?.drive ?? null,
      protocolVersion: nodeStatus.version?.protocol?.drive?.current ?? null,
      blockHeight: nodeStatus.chain != null ? BigInt(nodeStatus.chain.latestBlockHeight) : null,
      error: issue,
    }
  } catch (err) {
    const error = abortController.signal.aborted
      ? `no getStatus answer within ${DAPI_STATUS_TIMEOUT_MS}ms`
      : err instanceof Error ? err.message : String(err)
    return {dapiUrl, proTxHash: null, pingMs: null, driveVersion: null, protocolVersion: null, blockHeight: null, error}
  } finally {
    clearTimeout(timer)
  }
}
