import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'debug-9c1c66.log');

export function agentLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}) {
  const entry = {
    sessionId: '9c1c66',
    runId: payload.runId ?? 'pre-fix',
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    data: payload.data ?? {},
    timestamp: Date.now(),
  };

  try {
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // ignore file write failures in edge-like contexts
  }

  fetch('http://127.0.0.1:7825/ingest/d8511ac8-65d4-4268-a531-baa520abe45e', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '9c1c66',
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
}
