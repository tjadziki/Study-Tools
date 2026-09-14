import React from 'react';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });
const kicker = { ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' };

export default function Retrieval({ deck, actions, bankCourseId, onOpenError }) {
  const { fridayRows, bankRows, examCourses } = deck;
  const bank = deck.bankFor(bankCourseId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* ── practice grid ─────────────────────────────────────────────── */}
        <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
              Friday practice blocks
            </h6>
            <span style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>
              90 minutes per exam course, closed book
            </span>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={kicker}>STREAK</div>
              <div style={mono(26, { lineHeight: 1.1 })}>{deck.header.practiceStreakStr}</div>
            </div>
            <div>
              <div style={kicker}>BLOCKS LOGGED</div>
              <div style={mono(26, { lineHeight: 1.1 })}>{deck.blocksLoggedStr}</div>
            </div>
            <div>
              <div style={kicker}>ERRORS BANKED</div>
              <div style={mono(26, { lineHeight: 1.1, color: 'var(--color-accent)' })}>
                {deck.header.errorTotalStr}
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Friday</th>
                  {examCourses.map((c) => (
                    <th key={c.id}>{c.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fridayRows.map((f) => (
                  <tr key={f.date}>
                    <td style={mono(11.5, { color: 'rgba(238,243,248,.6)' })}>{f.label}</td>
                    {f.cells.map((cell) => (
                      <td key={cell.courseId}>
                        <button
                          onClick={() => actions.toggleBlock(cell.date, cell.courseId)}
                          style={{
                            appearance: 'none',
                            background: 'transparent',
                            border: 0,
                            padding: 2,
                            cursor: 'pointer',
                            color: 'var(--color-text)',
                          }}
                        >
                          {cell.done ? (
                            <span
                              style={{
                                ...mono(12),
                                width: 17,
                                height: 17,
                                display: 'grid',
                                placeItems: 'center',
                                background: 'var(--color-accent)',
                                color: '#151f29',
                              }}
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              style={{
                                width: 17,
                                height: 17,
                                display: 'block',
                                border: '1px solid rgba(238,243,248,.3)',
                              }}
                            />
                          )}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── error log ─────────────────────────────────────────────────── */}
        <div style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Error log</h6>
            <span style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>the reason, not the question number</span>
            <button
              className="btn btn-primary"
              onClick={onOpenError}
              style={{ fontSize: 12, marginLeft: 'auto', gap: 8, whiteSpace: 'nowrap' }}
            >
              Log an error{' '}
              <span style={{ ...mono(10), border: '1px solid rgba(21,31,41,.35)', padding: '0 4px' }}>E</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bankRows.map((bk) => (
              <button
                key={bk.id}
                onClick={() => actions.setBankCourseId(bk.id)}
                style={{
                  appearance: 'none',
                  border: '1px solid var(--color-divider)',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {bankCourseId === bk.id && (
                  <span style={{ width: 3, alignSelf: 'stretch', background: 'var(--color-accent)', flex: 'none' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...mono(11.5), letterSpacing: '.09em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                    {bk.course}
                  </div>
                  <div style={{ ...mono(12), color: 'rgba(238,243,248,.65)', marginTop: 2 }}>{bk.summary}</div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div style={mono(20, { lineHeight: 1.1 })}>{bk.countStr}</div>
                  <div style={mono(10, { color: 'rgba(238,243,248,.45)' })}>{bk.readyStr}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="blueprint" style={{ padding: '16px 18px', marginTop: 4 }}>
            <i className="corner tl" />
            <i className="corner tr" />
            <i className="corner bl" />
            <i className="corner br" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--color-accent)' }}>
                  EXAM REVIEW ARTEFACT
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 23, marginTop: 3 }}>
                  {deck.code(bankCourseId)} error log
                </div>
              </div>
              <div style={{ ...mono(12.5), color: 'rgba(238,243,248,.7)', textAlign: 'right' }}>
                {bank.counterStr}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {bank.topicGroups.map((g) => (
                <div key={g.topic} style={{ borderTop: '1px solid rgba(238,243,248,.12)', paddingTop: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                    <span style={mono(12, { color: 'var(--sig)' })}>×{g.countStr}</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17 }}>{g.topic}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                    {g.entries.map((en) => (
                      <div key={en.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ ...mono(10.5), color: 'rgba(238,243,248,.35)', flex: 'none', paddingTop: 2 }}>
                          {en.dateStr}
                        </span>
                        <span style={{ fontSize: 13, lineHeight: 1.4, flex: 1, minWidth: 0, textWrap: 'pretty' }}>
                          {en.what}
                        </span>
                        <button
                          className="btn btn-ghost"
                          onClick={() => actions.deleteError(en.id)}
                          style={{ fontSize: 10.5, padding: '0 3px', flex: 'none' }}
                        >
                          del
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {bank.topicGroups.length === 0 && (
              <div style={{ fontSize: 13, color: 'rgba(238,243,248,.5)', marginTop: 12 }}>
                Nothing banked for {deck.code(bankCourseId)} yet. This panel is what you read the night before the
                exam — if it is empty then, the exam is a first encounter.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
