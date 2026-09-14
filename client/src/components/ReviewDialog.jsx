import React from 'react';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });

export default function ReviewDialog({
  deck, step, setStep, actions, reflectionDraft, setReflectionDraft, onClose, onFinish,
}) {
  const top5 = deck.triage.rows.slice(0, 5);

  return (
    <div className="dialog-backdrop" style={{ zIndex: 60, alignItems: 'flex-start', paddingTop: '5vh' }}>
      <div className="dialog" style={{ width: 'min(620px, 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--color-accent)' }}>
            WEEKLY REVIEW · STEP {String(Math.max(1, step + 1)).padStart(2, '0')} OF 04
          </div>
          <div style={mono(10.5, { color: 'rgba(238,243,248,.4)' })}>~20 MIN</div>
        </div>

        {step === 0 && (
          <>
            <div className="dialog-title">Every concept older than 7 days gets closed or escalated.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: '44vh', overflow: 'auto' }}>
              {deck.stale.map((rc) => (
                <div key={rc.id} style={{ borderTop: '1px solid rgba(238,243,248,.12)', padding: '10px 0' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ ...mono(10.5), letterSpacing: '.09em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                      {rc.course}
                    </span>
                    <span style={mono(10.5, { color: 'var(--sig)' })}>{rc.ageStr}</span>
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.45, marginTop: 3, textWrap: 'pretty' }}>{rc.text}</div>
                  <div style={{ display: 'flex', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => actions.resolveConcept(rc.id)}
                      style={{ fontSize: 11.5, padding: '4px 9px' }}
                    >
                      Resolved
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => actions.escalateConcept(rc.id)}
                      style={{ fontSize: 11.5, padding: '4px 9px', whiteSpace: 'nowrap' }}
                    >
                      Booked with {deck.byId[rc.courseId]?.contactShort || 'the course'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {deck.stale.length === 0 && (
              <div style={{ fontSize: 13.5, color: 'rgba(238,243,248,.6)' }}>
                Nothing older than 7 days. Clean board.
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className="dialog-title">Next week's practice blocks — {deck.nextFridayStr}.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {deck.nextBlocks.map((nb) => (
                <button
                  key={nb.courseId}
                  onClick={() => actions.togglePlanned(nb.date, nb.courseId)}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: '1px solid var(--color-divider)',
                    padding: '9px 11px',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    font: 'inherit',
                  }}
                >
                  {nb.done ? (
                    <span
                      style={{
                        ...mono(12),
                        width: 16,
                        height: 16,
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
                    <span style={{ width: 16, height: 16, flex: 'none', border: '1px solid rgba(238,243,248,.35)' }} />
                  )}
                  <span style={{ ...mono(12), letterSpacing: '.06em' }}>{nb.course} · 90 MIN · SCHEDULED</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="dialog-title">Re-estimate the top 5. Bad estimates corrupt the ranking.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {top5.map((rt) => (
                <div
                  key={rt.id}
                  style={{
                    display: 'flex',
                    gap: 11,
                    alignItems: 'center',
                    borderTop: '1px solid rgba(238,243,248,.12)',
                    paddingTop: 9,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...mono(10.5), letterSpacing: '.09em', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                      {rt.course}
                    </div>
                    <div style={{ fontSize: 13.5 }}>{rt.title}</div>
                  </div>
                  <input
                    className="input"
                    key={`${rt.id}-${rt.estStr}`}
                    defaultValue={parseFloat(rt.estStr)}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v > 0) actions.patchTask(rt.id, { estHours: v });
                    }}
                    style={{ flex: 'none', width: 76, ...mono(12.5), minHeight: 32 }}
                  />
                  <span style={{ ...mono(11), color: 'rgba(238,243,248,.4)', flex: 'none' }}>hours</span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="dialog-title">What actually ate my time this week?</div>
            <textarea
              className="input"
              style={{ fontSize: 13.5, minHeight: 80 }}
              value={reflectionDraft}
              onChange={(e) => setReflectionDraft(e.target.value)}
              placeholder="One line. Honest."
            />
          </>
        )}

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
            Later
          </button>
          {step < 3 ? (
            <button className="btn btn-primary" onClick={() => setStep(Math.min(3, step + 1))} style={{ fontSize: 12.5 }}>
              Next
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onFinish} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
              Close the week
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
