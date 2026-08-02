import type { ParsedCapture } from '../types'
import init, { parse_capture } from './generated/nlp_engine.js'

let ready: Promise<void> | null = null

export function initNlp(): Promise<void> {
  if (!ready) {
    ready = init().then(() => undefined)
  }
  return ready
}

/** Synchronous check for callers that want to avoid a loading flash. */
export function isNlpReady(): boolean {
  return ready !== null
}

export function parseCapture(text: string, today: Date, knownListIds: string[]): ParsedCapture {
  const result = parse_capture(
    text,
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
    knownListIds,
  )
  return result as ParsedCapture
}
