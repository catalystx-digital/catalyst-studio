import chalk from 'chalk'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

const levelPrefixes: Record<LogLevel, string> = {
  info: chalk.cyan('[i]'),
  warn: chalk.yellow('[!]'),
  error: chalk.red('[x]'),
  debug: chalk.gray('[.]')
}

const LOG_FORMAT = (process.env.CATALYST_HEAD_LOG_FORMAT ?? 'text').toLowerCase()
const USE_JSON = LOG_FORMAT === 'json'

let verbose = false

function shouldEmit(level: LogLevel): boolean {
  return level !== 'debug' || verbose
}

function isContextEmpty(context?: Record<string, unknown>): boolean {
  return !context || Object.keys(context).length === 0
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldEmit(level)) {
    return
  }

  const metadata = isContextEmpty(context) ? undefined : context

  if (USE_JSON) {
    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message
    }

    if (metadata) {
      payload.context = metadata
    }

    console.log(JSON.stringify(payload))
    return
  }

  const prefix = levelPrefixes[level]
  const base = `${prefix} ${message}`

  if (metadata) {
    console.log(`${base} ${chalk.gray(JSON.stringify(metadata))}`)
  } else {
    console.log(base)
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  setVerbose(enabled: boolean) {
    verbose = enabled
  }
}
