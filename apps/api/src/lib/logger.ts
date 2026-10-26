/**
 * Structured JSON logging, one line per entry, for CloudWatch. Small on purpose: the
 * brief asks for enough to debug a Lambda at 11pm, not a telemetry stack.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

const levels: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const level = (process.env.LOG_LEVEL ?? 'info') as LogLevel;
  return levels[level] ?? levels.info;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

export function createLogger(
  service: string,
  base: Record<string, unknown> = {},
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): Logger {
  const emit = (level: LogLevel, message: string, fields: Record<string, unknown> = {}) => {
    if (levels[level] < threshold()) return;
    const entry: Record<string, unknown> = {
      level,
      time: new Date().toISOString(),
      service,
      message,
      ...base,
      ...fields,
    };
    if ('error' in entry) entry.error = serializeError(entry.error);
    write(JSON.stringify(entry));
  };
  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: (fields) => createLogger(service, { ...base, ...fields }, write),
  };
}
