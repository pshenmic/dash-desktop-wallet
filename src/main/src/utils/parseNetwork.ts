import {NetworkNameSchema, PeerMode, PeerModeSchema} from '../preferences/network'
import {Network} from '../types/Network'

export function parseNetwork(channel: string, value: unknown): Network {
  const parsed = NetworkNameSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`${channel}: expected 'mainnet' or 'testnet', got ${JSON.stringify(value)}`)
  }
  return parsed.data
}

export function parsePeerMode(channel: string, value: unknown): PeerMode {
  const parsed = PeerModeSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`${channel}: expected 'dynamic' or 'static', got ${JSON.stringify(value)}`)
  }
  return parsed.data
}