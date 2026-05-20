import { DomProbeArtifacts } from './artifacts'

export interface RunLogger {
  info: (...messages: any[]) => Promise<void>
  warn: (...messages: any[]) => Promise<void>
  error: (...messages: any[]) => Promise<void>
  debug: (...messages: any[]) => Promise<void>
}

function formatLine(level: string, messages: any[]): string {
  const timestamp = new Date().toISOString()
  const serialized = messages
    .map(message => {
      if (typeof message === 'string') return message
      try {
        return JSON.stringify(message)
      } catch {
        return String(message)
      }
    })
    .join(' ')
  return `[${timestamp}] [${level}] ${serialized}`
}

async function write(artifacts: DomProbeArtifacts, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', messages: any[]): Promise<void> {
  const line = formatLine(level, messages)
  if (level === 'ERROR') {
    console.error(line)
  } else if (level === 'WARN') {
    console.warn(line)
  } else {
    console.log(line)
  }
  await artifacts.appendLog(line)
}

export function createRunLogger(artifacts: DomProbeArtifacts): RunLogger {
  return {
    info: (...messages: any[]) => write(artifacts, 'INFO', messages),
    warn: (...messages: any[]) => write(artifacts, 'WARN', messages),
    error: (...messages: any[]) => write(artifacts, 'ERROR', messages),
    debug: (...messages: any[]) => write(artifacts, 'DEBUG', messages)
  }
}
