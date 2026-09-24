import React from 'react';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });
const kicker = { ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' };

function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

export default function Triage({ deck, actions, showDone, onToggleDone, onGoConfig, onOpenLadder }) {
  const { triage, stake, horizonList, conceptList, weekBlocks, blindSpots, rules } = deck;
  const top = triage.top;
  const slipDays = Number(deck.settings.slipDays ?? 3);

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* ── queue ───────────────────────────────────────────────────────── */}
      <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h6 style={{ margin: 0, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>Triage queue</h6>
          <span style={{ fontSize: 12, color: 'rgba(238,243,248,.5)' }}>
            <span style={{ whiteSpace: 'nowrap' }}>within a week of slack: least slack first</span>
            {' · '}
            <span style={{ whiteSpace: 'nowrap' }}>otherwise (marks/hour × 10) + (urgency × 30) − 5 if droppable</span>
            {' · '}
            <span style={{ whiteSpace: 'nowrap' }}>exams enter the queue at T-{rules.horizon}</span>
          </span>
        </div>

        {top ? (
          <div
            className="blueprint"
            style={{
              padding: '20px 22px 18px',
              background: 'rgba(226,145,63,.06)',
              borderColor: 'rgba(226,145,63,.5)',
            }}
          >
            <Corners />
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginBottom: 9,
                  }}
                >
                  <span
                    style={{
                      ...mono(10),
                      letterSpacing: '.14em',
                      background: 'var(--sig)',
                      color: '#151f29',
                      padding: '3px 7px',
                    }}
                  >
                    WORK ON THIS NOW
                  </span>
                  <span
                    style={{ ...mono(12), letterSpacing: '.1em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}
                  >
                    {top.course}
                  </span>
                  {top.isExam && (
                    <span className="tag tag-outline" style={mono(10)}>
                      EXAM PREP
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    fontSize: 31,
                    lineHeight: 1.06,
                    letterSpacing: '-.01em',
                    textWrap: 'pretty',
                  }}
                >
                  {top.title}
                </div>
                <div style={{ ...mono(12.5), color: 'rgba(238,243,248,.72)', marginTop: 10 }}>
                  {top.reason}
                </div>
                {top.isTrap && (
                  <div
                    style={{
                      marginTop: 12,
                      borderLeft: '2px solid var(--sig)',
                      padding: '4px 0 4px 10px',
                      fontSize: 13,
                      color: 'var(--sig)',
                    }}
                  >
                    Low marks, high exam value — treat as exam prep.
                  </div>
                )}
                {top.isFree && (
                  <div
                    style={{
                      marginTop: 12,
                      borderLeft: '2px solid var(--color-accent)',
                      padding: '4px 0 4px 10px',
                      fontSize: 13,
                      color: 'var(--color-accent)',
                    }}
                  >
                    Cheap marks — never skip.
                  </div>
                )}
                {top.hasNote && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(238,243,248,.5)' }}>{top.note}</div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => actions.setStatus(top.id, 'done')}
                    style={{ fontSize: 12.5, letterSpacing: '.06em', whiteSpace: 'nowrap' }}
                  >
                    Mark submitted
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => actions.openStuckFor(top.courseId)}
                    style={{ fontSize: 12.5, letterSpacing: '.06em', whiteSpace: 'nowrap' }}
                  >
                    Start stuck timer
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => actions.openErrorFor(top.courseId)}
                    style={{ fontSize: 12.5, letterSpacing: '.06em', whiteSpace: 'nowrap' }}
                  >
                    Log an error
                  </button>
                </div>
              </div>
              <div style={{ flex: '0 0 auto', display: 'flex', gap: 26 }}>
                <div>
                  <div style={kicker}>WEIGHT</div>
                  <div style={mono(34, { lineHeight: 1.05 })}>{top.weightStr}</div>
                  <div style={{ ...kicker, marginTop: 14 }}>EST</div>
                  <div style={mono(19, { lineHeight: 1.1 })}>{top.estStr}</div>
                </div>
                <div>
                  <div style={kicker}>{top.rankLabel}</div>
                  <div style={mono(34, { lineHeight: 1.05, color: 'var(--sig)' })}>{top.rankStr}</div>
                  <div style={{ ...kicker, marginTop: 14 }}>DUE</div>
                  <div style={mono(14, { lineHeight: 1.25 })}>{top.dueStr}</div>
                  <div style={mono(11, { color: 'var(--sig)' })}>{top.daysStr}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontSize: 14, color: 'rgba(238,243,248,.6)' }}>
              Queue empty. Everything with a due date is submitted — go bank retrieval practice.
            </div>
          </div>
        )}

        {/* ── ranked rest ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {triage.rest.map((r, i) => (
            <React.Fragment key={r.id}>
            {/* A divider wherever the ranking rule changes — within "urgent"
                the order is by slack, everywhere else by priority score, and
                the reader needs to see which is which. */}
            {(i === 0 ? triage.top?.tier !== r.tier : triage.rest[i - 1].tier !== r.tier) && (
              <div
                style={{
                  ...mono(9.5),
                  letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  color: r.tier === 0 ? 'var(--sig)' : 'rgba(238,243,248,.45)',
                  padding: '16px 0 6px',
                }}
              >
                {r.tierLabel}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                padding: '12px 2px 12px 0',
                borderTop: '1px solid rgba(238,243,248,.1)',
              }}
            >
              <div style={{ ...mono(13), color: 'rgba(238,243,248,.35)', width: 22, flex: 'none', paddingTop: 2 }}>
                {r.rank}
              </div>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ ...mono(11), letterSpacing: '.1em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                    {r.course}
                  </span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, lineHeight: 1.15 }}>
                    {r.title}
                  </span>
                  {r.isExam && (
                    <span
                      style={{
                        ...mono(9.5),
                        letterSpacing: '.12em',
                        border: '1px solid var(--color-divider)',
                        padding: '1px 5px',
                        color: 'rgba(238,243,248,.6)',
                      }}
                    >
                      EXAM
                    </span>
                  )}
                </div>
                <div style={{ ...mono(11.5), color: 'rgba(238,243,248,.55)', marginTop: 4 }}>{r.reason}</div>
                {r.isTrap && (
                  <div style={{ fontSize: 12, color: 'var(--sig)', marginTop: 4 }}>
                    Low marks, high exam value — treat as exam prep.
                  </div>
                )}
                {r.isFree && (
                  <div style={{ fontSize: 12, color: 'var(--color-accent)', marginTop: 4 }}>
                    Cheap marks — never skip.
                  </div>
                )}
                <div
                  style={{
                    height: 2,
                    background: 'rgba(238,243,248,.08)',
                    marginTop: 8,
                    maxWidth: 420,
                  }}
                >
                  <div style={r.barStyle} />
                </div>
              </div>
              <div style={{ flex: 'none', display: 'flex', gap: 18, alignItems: 'flex-start', paddingTop: 2 }}>
                <div style={{ textAlign: 'right', minWidth: 52 }}>
                  <div style={mono(16)}>{r.weightStr}</div>
                  <div style={mono(10, { color: 'rgba(238,243,248,.4)' })}>{r.estStr}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 96 }}>
                  <div style={mono(12.5)}>{r.dueStr}</div>
                  <div style={mono(10.5, { color: 'rgba(238,243,248,.45)' })}>{r.daysStr}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 52 }}>
                  <div style={mono(16, { color: 'var(--sig)' })}>{r.rankStr}</div>
                  <div style={mono(8.5, { color: 'rgba(238,243,248,.35)', letterSpacing: '.12em' })}>{r.rankLabel}</div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => actions.setStatus(r.id, 'done')}
                  style={{ fontSize: 11, letterSpacing: '.06em', padding: '4px 8px', whiteSpace: 'nowrap' }}
                >
                  Done
                </button>
              </div>
            </div>
            </React.Fragment>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 6,
            borderTop: '1px solid rgba(238,243,248,.1)',
          }}
        >
          <button className="btn btn-ghost" onClick={onToggleDone} style={{ fontSize: 12, letterSpacing: '.06em' }}>
            {showDone ? 'Hide submitted' : 'Show submitted'}
          </button>
          {showDone && (
            <span style={mono(11, { color: 'rgba(238,243,248,.4)' })}>{triage.doneCountStr}</span>
          )}
        </div>
        {showDone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {triage.doneTasks.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'baseline',
                  ...mono(11.5),
                  color: 'rgba(238,243,248,.45)',
                }}
              >
                <span style={{ color: 'var(--color-accent)' }}>{t.course}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{t.title}</span>
                <span>{t.weightStr}</span>
                <button
                  className="btn btn-ghost"
                  onClick={() => actions.setStatus(t.id, 'todo')}
                  style={{ fontSize: 10.5, padding: '0 4px' }}
                >
                  undo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── aside ───────────────────────────────────────────────────────── */}
      <aside
        style={{
          flex: '1 1 300px',
          maxWidth: 400,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div className="card" style={{ padding: '14px 15px', gap: 10 }}>
          <div className="card-kicker" style={{ color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
            At stake
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
            <div style={mono(32, { lineHeight: 1, color: 'var(--sig)' })}>{deck.header.unbankedStr}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(238,243,248,.55)', lineHeight: 1.3, paddingBottom: 3 }}>
              of each course's marks
              <br />
              still unbanked (avg)
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
            {stake.map((s) => (
              <div key={s.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    ...mono(10.5),
                    color: 'rgba(238,243,248,.65)',
                  }}
                >
                  <span>{s.code}</span>
                  <span>{s.label}</span>
                </div>
                <div style={{ height: 3, background: 'rgba(238,243,248,.1)', marginTop: 3 }}>
                  <div style={s.barStyle} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 15px', gap: 9 }}>
          <div className="card-kicker" style={{ color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
            Horizon
          </div>
          {horizonList.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'rgba(238,243,248,.45)' }}>
              No exam has a confirmed date yet. Rescan, then confirm the dates in the review queue.
            </div>
          )}
          {horizonList.map((hz, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...mono(11), letterSpacing: '.09em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                  {hz.course}
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15 }}>{hz.name}</div>
                <div style={mono(10.5, { color: 'rgba(238,243,248,.45)' })}>{hz.dateStr}</div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={mono(19, { lineHeight: 1.1 })}>{hz.daysStr}</div>
                <div style={mono(10.5, { color: 'rgba(238,243,248,.45)' })}>{hz.weightStr}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '14px 15px', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="card-kicker" style={{ color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
              Open concepts
            </div>
            <div style={mono(11, { color: 'rgba(238,243,248,.45)' })}>{deck.conceptCountStr}</div>
          </div>
          {conceptList.map((c) => (
            <div key={c.id} style={{ borderTop: '1px solid rgba(238,243,248,.1)', paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ ...mono(10.5), letterSpacing: '.09em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                  {c.course}
                </span>
                {c.stale ? (
                  <span style={{ ...mono(10), background: 'var(--sig)', color: '#151f29', padding: '1px 5px' }}>
                    {c.ageStr} · ESCALATE
                  </span>
                ) : (
                  <span style={mono(10, { color: 'rgba(238,243,248,.4)' })}>{c.ageStr}</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.4, marginTop: 3, textWrap: 'pretty' }}>{c.text}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="btn btn-ghost" onClick={() => onOpenLadder(c.id)} style={{ fontSize: 11, padding: '0 4px' }}>
                  ladder
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => actions.resolveConcept(c.id)}
                  style={{ fontSize: 11, padding: '0 4px' }}
                >
                  resolved
                </button>
              </div>
            </div>
          ))}
          {conceptList.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'rgba(238,243,248,.45)' }}>
              Nothing open. Press S the moment you lose the thread.
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: 'rgba(238,243,248,.4)',
              borderTop: '1px solid rgba(238,243,248,.1)',
              paddingTop: 8,
            }}
          >
            No concept survives past the weekly review.
          </div>
        </div>

        <div className="card" style={{ padding: '14px 15px', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="card-kicker" style={{ color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
              This week's practice
            </div>
            <div style={mono(11, { color: 'rgba(238,243,248,.45)' })}>{deck.weekBlockDateStr}</div>
          </div>
          {weekBlocks.map((b) => (
            <button
              key={b.courseId}
              onClick={() => actions.toggleBlock(b.date, b.courseId)}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: '1px solid var(--color-divider)',
                padding: '7px 9px',
                cursor: 'pointer',
                color: 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                textAlign: 'left',
                font: 'inherit',
              }}
            >
              {b.done ? (
                <span
                  style={{
                    ...mono(12),
                    width: 15,
                    height: 15,
                    flex: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--color-accent)',
                    color: '#151f29',
                  }}
                >
                  ✓
                </span>
              ) : (
                <span style={{ width: 15, height: 15, flex: 'none', border: '1px solid rgba(238,243,248,.35)' }} />
              )}
              <span style={{ ...mono(11.5), letterSpacing: '.06em', flex: 1 }}>{b.course} · 90 MIN</span>
              <span style={mono(10, { color: 'rgba(238,243,248,.4)' })}>{b.errStr}</span>
            </button>
          ))}
          <div style={{ fontSize: 11, color: 'rgba(238,243,248,.4)' }}>
            Closed-book textbook problems. Reading does not count.
          </div>
        </div>

        {blindSpots.length > 0 && (
          <div
            className="blueprint"
            style={{ padding: '13px 15px', borderColor: 'rgba(226,145,63,.5)', background: 'rgba(226,145,63,.06)' }}
          >
            <Corners />
            <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>BLIND SPOT</div>
            <div style={{ fontSize: 13, lineHeight: 1.45, marginTop: 5 }}>
              {blindSpots.map((c) => c.code).join(', ')} has no weights entered, so nothing from it can be ranked.
              Pull the outline off LEARN.
            </div>
            <button className="btn btn-secondary" onClick={onGoConfig} style={{ fontSize: 11.5, marginTop: 9 }}>
              Enter weights
            </button>
          </div>
        )}

        <div className="card" style={{ padding: '13px 15px', gap: 7 }}>
          <div className="card-kicker" style={{ color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
            HLTH 101 slip days
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={mono(26, { lineHeight: 1 })}>{slipDays} left</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-secondary"
                onClick={() => actions.settings({ slipDays: Math.max(0, slipDays - 1) })}
                style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
              >
                spend
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => actions.settings({ slipDays: Math.min(3, slipDays + 1) })}
                style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
              >
                restore
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(238,243,248,.4)' }}>
            No questions asked. Spend them on discussions, never on a term test.
          </div>
        </div>
      </aside>
    </div>
  );
}
