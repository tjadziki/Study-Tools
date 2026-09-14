import React, { useState } from 'react';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });

const CONF = {
  high: { label: 'HIGH', color: '#8fce9a', bg: 'rgba(143,206,154,.12)' },
  medium: { label: 'MEDIUM', color: 'var(--color-accent)', bg: 'rgba(148,188,227,.12)' },
  low: { label: 'LOW', color: 'var(--sig)', bg: 'rgba(226,145,63,.12)' },
};

function Badge({ confidence }) {
  const c = CONF[confidence] || CONF.low;
  return (
    <span
      style={{
        ...mono(9.5),
        letterSpacing: '.13em',
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.color}`,
        padding: '2px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}

/** The evidence panel: the sentence the date came from, plus why we trust it. */
function Snippet({ text, file }) {
  const [snippet, reason] = String(text).split('\n— ');
  return (
    <div
      style={{
        borderLeft: '2px solid var(--color-divider)',
        padding: '5px 0 5px 11px',
        marginTop: 8,
      }}
    >
      <div style={{ ...mono(11.5), color: 'rgba(238,243,248,.8)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {snippet?.replace(/\t/g, '   ')}
      </div>
      {reason && (
        <div style={{ fontSize: 11.5, color: 'rgba(238,243,248,.5)', marginTop: 4, textWrap: 'pretty' }}>
          {reason}
        </div>
      )}
      {file && (
        <div style={{ ...mono(10), color: 'rgba(238,243,248,.35)', marginTop: 4 }}>{file}</div>
      )}
    </div>
  );
}

export default function ReviewQueue({ deck, actions }) {
  const [edits, setEdits] = useState({});
  const rows = deck.reviewQueue;
  const setEdit = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const conflicts = rows.filter((r) => r.kind === 'conflict');
  const dates = rows.filter((r) => r.kind === 'date');
  const items = rows.filter((r) => r.kind === 'item');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Review queue</h6>
        <span style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>
          every extracted date is a candidate · nothing here reaches the triage queue until you confirm it
        </span>
      </div>

      {rows.length === 0 && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 14, color: 'rgba(238,243,248,.6)' }}>
            Nothing waiting. Run a rescan when a professor posts something new.
          </div>
        </div>
      )}

      {/* ── conflicts first: they touch dates already confirmed ─────────── */}
      {conflicts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>
            CONFLICTS WITH CONFIRMED DATES · {conflicts.length}
          </div>
          {conflicts.map((r) => (
            <div
              key={r.id}
              className="blueprint"
              style={{ padding: '14px 16px', borderColor: 'rgba(226,145,63,.5)', background: 'rgba(226,145,63,.06)' }}
            >
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ ...mono(11), letterSpacing: '.1em', color: 'var(--color-accent)' }}>{r.course}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18 }}>{r.title}</span>
                <Badge confidence={r.confidence} />
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' }}>YOU CONFIRMED</div>
                  <div style={mono(16)}>{r.currentStr}</div>
                </div>
                <div>
                  <div style={{ ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' }}>SCAN NOW SAYS</div>
                  <div style={mono(16, { color: 'var(--sig)' })}>{r.proposedStr}</div>
                </div>
              </div>
              <Snippet text={r.sourceSnippet} file={r.sourceFile} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => actions.resolveConflict(r.id, false)}
                  style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Keep {r.currentStr}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => actions.resolveConflict(r.id, true)}
                  style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Use {r.proposedStr}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── proposed dates for known deliverables ───────────────────────── */}
      {dates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--color-accent)' }}>
            PROPOSED DATES · {dates.length}
          </div>
          {dates.map((r) => {
            const value = edits[r.id]?.dueDate ?? r.proposedDate ?? '';
            const changed = value !== r.proposedDate;
            return (
              <div key={r.id} className="card" style={{ padding: '13px 15px', gap: 0 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ ...mono(11), letterSpacing: '.1em', color: 'var(--color-accent)' }}>{r.course}</span>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17 }}>{r.title}</span>
                      {r.isExam && (
                        <span style={{ ...mono(9.5), letterSpacing: '.12em', border: '1px solid var(--color-divider)', padding: '1px 5px', color: 'rgba(238,243,248,.6)' }}>
                          EXAM
                        </span>
                      )}
                      <Badge confidence={r.confidence} />
                    </div>
                    <Snippet text={r.sourceSnippet} file={r.sourceFile} />
                  </div>
                  <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 7, minWidth: 168 }}>
                    <div>
                      <div style={{ ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' }}>PROPOSED</div>
                      <input
                        className="input"
                        type="date"
                        value={value}
                        onChange={(e) => setEdit(r.id, { dueDate: e.target.value })}
                        style={{ ...mono(12), minHeight: 32, marginTop: 3 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => actions.confirmTask(r.id, value ? { dueDate: value } : {})}
                        style={{ fontSize: 11.5, flex: 1, whiteSpace: 'nowrap' }}
                      >
                        {changed ? 'Correct & confirm' : 'Confirm'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => actions.rejectTask(r.id)}
                        style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── proposed new deliverables ───────────────────────────────────── */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--color-accent)' }}>
            PROPOSED NEW ITEMS · {items.length}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>
            These dates matched no deliverable already in the deck. Give one a weight and an estimate to add it, or
            reject it.
          </div>
          {items.map((r) => {
            const e = edits[r.id] || {};
            return (
              <div key={r.id} className="card" style={{ padding: '13px 15px', gap: 0 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ ...mono(11), letterSpacing: '.1em', color: 'var(--color-accent)' }}>{r.course}</span>
                      <Badge confidence={r.confidence} />
                    </div>
                    <input
                      className="input"
                      value={e.title ?? r.title}
                      onChange={(ev) => setEdit(r.id, { title: ev.target.value })}
                      style={{ fontSize: 13.5, marginTop: 6 }}
                    />
                    <Snippet text={r.sourceSnippet} file={r.sourceFile} />
                  </div>
                  <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 7, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' }}>WEIGHT %</div>
                        <input
                          className="input"
                          value={e.weight ?? ''}
                          onChange={(ev) => setEdit(r.id, { weight: ev.target.value })}
                          style={{ ...mono(12), minHeight: 32, marginTop: 3 }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' }}>EST. H</div>
                        <input
                          className="input"
                          value={e.estHours ?? ''}
                          onChange={(ev) => setEdit(r.id, { estHours: ev.target.value })}
                          style={{ ...mono(12), minHeight: 32, marginTop: 3 }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' }}>DUE</div>
                      <input
                        className="input"
                        type="date"
                        value={e.dueDate ?? r.proposedDate ?? ''}
                        onChange={(ev) => setEdit(r.id, { dueDate: ev.target.value })}
                        style={{ ...mono(12), minHeight: 32, marginTop: 3 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          actions.confirmTask(r.id, {
                            title: e.title ?? r.title,
                            weight: e.weight,
                            estHours: e.estHours,
                            dueDate: e.dueDate ?? r.proposedDate,
                          })
                        }
                        style={{ fontSize: 11.5, flex: 1, whiteSpace: 'nowrap' }}
                      >
                        Add to deck
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => actions.rejectTask(r.id)}
                        style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
