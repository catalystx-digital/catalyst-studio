import { createRequire } from 'node:module'
import { errorRecord } from './storage'
export const runtimeRequire = createRequire(__filename)

// These replacements exist only in this CLI process and are restored after each run.
export function replaceExports(name: string, overrides: Record<string, unknown>) {
  const id = runtimeRequire.resolve(name)
  const original = runtimeRequire(name)
  const entry = runtimeRequire.cache[id]
  if (!entry) throw new Error('Module was not cached: ' + name)
  entry.exports = { ...original, ...overrides }
  return () => { entry.exports = original }
}
export function captureConsole(events: unknown[]) {
  const originals = { log: console.log, warn: console.warn, error: console.error }
  for (const level of ['log', 'warn', 'error'] as const) console[level] = (...args: unknown[]) => {
    events.push({ level, at: new Date().toISOString(), args: args.map(value => value instanceof Error ? errorRecord(value) : value) })
  }
  return () => Object.assign(console, originals)
}
export function blockNetwork() {
  const saved = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Network is forbidden in this offline command') }
  const net = runtimeRequire('node:net')
  const connect = net.Socket.prototype.connect
  net.Socket.prototype.connect = function() { throw new Error('Network socket is forbidden in this offline command') }
  return () => { globalThis.fetch = saved; net.Socket.prototype.connect = connect }
}
