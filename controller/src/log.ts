// JSON-lines logger. Any field whose name looks secret is replaced before it
// is written, as a second line of defence: code never passes passwords here.

export type Logger = {
  info: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
  error: (event: string, fields?: Record<string, unknown>) => void;
};

const SECRET = /pass(word)?|secret|ciphertext|private|token|authorization|credential_value/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = SECRET.test(k) ? '[redacted]' : redact(v, depth + 1);
  return out;
}

export function createLogger(write: (line: string) => void = (l) => process.stdout.write(l + '\n')): Logger {
  const emit = (level: string, event: string, fields?: Record<string, unknown>) =>
    write(JSON.stringify({ t: new Date().toISOString(), level, event, ...(redact(fields ?? {}) as object) }));
  return {
    info: (e, f) => emit('info', e, f),
    warn: (e, f) => emit('warn', e, f),
    error: (e, f) => emit('error', e, f),
  };
}

export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
