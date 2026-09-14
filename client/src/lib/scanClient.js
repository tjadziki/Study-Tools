// Drives POST /api/scan and reports progress as it streams.
//
// The endpoint answers with newline-delimited JSON: many progress lines, then
// a summary, then the refreshed deck state. Reading it incrementally is what
// makes the live file counter real rather than a spinner that guesses.

export async function runScan({ onProgress, onPhase, force = false } = {}) {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch { /* body was not JSON */ }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let summary = null;
  let state = null;
  let error = null;

  const handle = (line) => {
    if (!line.trim()) return;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      return; // a partial line; the buffer will catch it next round
    }
    if (ev.type === 'progress') onProgress?.(ev);
    else if (ev.type === 'phase') onPhase?.(ev);
    else if (ev.type === 'done') summary = ev.summary;
    else if (ev.type === 'state') state = ev.state;
    else if (ev.type === 'error') error = ev.error;
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const l of lines) handle(l);
  }
  handle(buffer);

  if (error) throw new Error(error);
  return { summary, state };
}
