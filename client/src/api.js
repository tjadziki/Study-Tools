// Thin wrapper over the local API. Every mutating call returns the whole new
// deck state, so the client never has to guess what the server did.

async function call(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`${res.status} ${res.statusText} — server sent no JSON.`);
  }
  if (!res.ok || payload.ok === false) {
    throw new Error(payload.error || `${res.status} ${res.statusText}`);
  }
  return payload;
}

export const api = {
  getState: () => call('/api/state'),
  scan: (body = {}) => call('/api/scan', body),

  addTask: (body) => call('/api/tasks', body),
  patchTask: (id, body) => call(`/api/tasks/${encodeURIComponent(id)}`, body),
  deleteTask: (id) => call(`/api/tasks/${encodeURIComponent(id)}`, { delete: true }),

  addError: (body) => call('/api/errors', body),
  deleteError: (id) => call(`/api/errors/${encodeURIComponent(id)}`, { delete: true }),

  confirmTask: (id, body = {}) => call(`/api/tasks/${encodeURIComponent(id)}`, { confirm: true, ...body }),
  rejectTask: (id) => call(`/api/tasks/${encodeURIComponent(id)}`, { reject: true }),
  resolveConflict: (id, accept) => call(`/api/conflicts/${encodeURIComponent(id)}`, accept ? { accept: true } : { dismiss: true }),
  termWeeks: (weeks, confirm) => call('/api/term-weeks', { weeks, confirm }),

  addConcept: (body) => call('/api/concepts', body),
  patchConcept: (id, body) => call(`/api/concepts/${encodeURIComponent(id)}`, body),

  toggleSlot: (body) => call('/api/plan', body),
  classBlocks: (blocks) => call('/api/class-blocks', { blocks }),

  session: (body) => call('/api/sessions', body),
  settings: (body) => call('/api/settings', body),
  reset: () => call('/api/reset', {}),
};
