import path from 'path'
import {utilityProcess, UtilityProcess} from 'electron'
import {CHILD_OUTPUT_TAIL_LIMIT} from '../constants/app'
import {logChildOutput} from '../logTransport'
import {currentLogLevel, Logger} from './logger'

// Forks a utility process with a rolling stdout+stderr tail, so a crash carries
// its own cause instead of a bare exit code. The caller owns the message
// handling and whatever state an exit resets.
export function forkWorker<T>(
  name: 'p2p' | 'platform',
  log: Logger,
  onMessage: (data: T) => void,
  onExit: (code: number, crashDetail: string) => void,
): UtilityProcess {
  const scriptPath = path.join(__dirname, `${name}.js`)
  let outputTail = ''
  const child = utilityProcess.fork(scriptPath, [], {serviceName: name, stdio: ['ignore', 'pipe', 'pipe']})
  log.info('utility process forked')

  // Mirror the worker's output to the main-process streams while retaining a
  // tail for crash reports.
  child.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    outputTail = (outputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
    logChildOutput(name, text, false)
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    outputTail = (outputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
    logChildOutput(name, text, true)
  })

  child.on('message', (data: T) => onMessage(data))

  child.on('exit', code => {
    const tail = outputTail.trim()
    log.info(`utility process exited code=${code}`)
    if (tail) log.error(`last output before exit:\n${tail}`)
    onExit(code, tail ? `\n--- ${name} output (tail) ---\n${tail}` : '')
  })

  child.postMessage({type: 'setLogLevel', level: currentLogLevel()})
  return child
}
