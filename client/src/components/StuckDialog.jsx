import React from 'react';
import { LADDER } from '../lib/deck.js';

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });

export default function StuckDialog({
  deck, phase, stuck, draft, setDraft, minutes, now, onStart, onClose, onEscalateNow, actions,
}) {
  const activeConcept = stuck.conceptId
    ? deck.conceptList.find((c) => c.id === stuck.conceptId)
    : null;
  const remain = phase === 'run' ? Math.max(0, stuck.endsAt - now) : 0;
  const ladderCourseId = activeConcept ? activeConcept.courseId : draft.courseId;
  const contact = deck.byId[ladderCourseId]?.contact || '';

  const clock =
    String(Math.floor(remain / 60000)).padStart(2, '0') +
    ':' +
    String(Math.floor(remain / 1000) % 60).padStart(2, '0');

  const shownText = activeConcept ? activeConcept.text : draft.text || '';

  return (
    <div className="dialog-backdrop" style={{ zIndex: 60, alignItems: 'flex-start', paddingTop: '6vh' }}>
      <div className="dialog" style={{ width: 'min(560px, 100%)' }}>
        {phase === 'draft' && (
          <>
            <div>
              <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>
                STUCK TIMER · {minutes} MIN
              </div>
              <div className="dialog-title" style={{ marginTop: 5 }}>
                Write the exact sentence where you lost the thread.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {deck.courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDraft({ ...draft, courseId: c.id })}
                  style={{
                    appearance: 'none',
                    cursor: 'pointer',
                    ...mono(11),
                    letterSpacing: '.07em',
                    padding: '5px 9px',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-divider)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {draft.courseId === c.id ? (
                    <span style={{ color: 'var(--color-accent)' }}>▍{c.code}</span>
                  ) : (
                    <span style={{ opacity: 0.55 }}>{c.code}</span>
                  )}
                </button>
              ))}
            </div>
            <textarea
              className="input"
              style={{ fontSize: 13.5, minHeight: 84 }}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder="e.g. I don't understand why the modal transformation decouples the equations only for proportional damping."
            />
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12.5 }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onStart} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                Start {minutes}:00
              </button>
            </div>
          </>
        )}

        {phase === 'run' && (
          <>
            <div>
              <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>
                {deck.code(ladderCourseId)} · TIMER RUNNING
              </div>
              <div style={{ ...mono(64), lineHeight: 1, letterSpacing: '.02em', marginTop: 8 }}>{clock}</div>
              <div style={{ height: 3, background: 'rgba(238,243,248,.12)', marginTop: 10 }}>
                <div
                  style={{
                    width: `${Math.round((remain / (minutes * 60000)) * 100)}%`,
                    height: '100%',
                    background: 'var(--sig)',
                  }}
                />
              </div>
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                borderLeft: '2px solid var(--color-accent)',
                padding: '6px 0 6px 12px',
                textWrap: 'pretty',
              }}
            >
              {shownText}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(238,243,248,.55)' }}>
              When this hits zero the timer does not restart. You escalate.
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                Keep working (hide)
              </button>
              <button className="btn btn-primary" onClick={onEscalateNow} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                Escalate now
              </button>
            </div>
          </>
        )}

        {phase === 'ladder' && (
          <>
            <div>
              <div style={{ ...mono(9.5), letterSpacing: '.15em', color: 'var(--sig)' }}>
                {deck.code(ladderCourseId)} · TIME IS UP — ESCALATION LADDER
              </div>
              <div className="dialog-title" style={{ marginTop: 5 }}>
                Three hours on one concept is a decision, not an accident.
              </div>
            </div>
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                borderLeft: '2px solid var(--color-accent)',
                padding: '6px 0 6px 12px',
                color: 'rgba(238,243,248,.8)',
                textWrap: 'pretty',
              }}
            >
              {shownText}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {LADDER.map((l, i) => {
                const on = !!(activeConcept && activeConcept.rungs[i]);
                return (
                  <div
                    key={l.step}
                    style={{
                      display: 'flex',
                      gap: 11,
                      alignItems: 'flex-start',
                      padding: '11px 0',
                      borderTop: '1px solid rgba(238,243,248,.12)',
                    }}
                  >
                    <button
                      onClick={() => {
                        if (!activeConcept) return;
                        const rungs = activeConcept.rungs.slice();
                        rungs[i] = !rungs[i];
                        actions.patchConcept(activeConcept.id, { rungs });
                      }}
                      style={{
                        appearance: 'none',
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        cursor: 'pointer',
                        flex: 'none',
                        marginTop: 2,
                      }}
                    >
                      {on ? (
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
                          style={{ width: 17, height: 17, display: 'block', border: '1px solid rgba(238,243,248,.35)' }}
                        />
                      )}
                    </button>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ ...mono(10.5), letterSpacing: '.1em', color: 'var(--sig)', whiteSpace: 'nowrap' }}>
                          {l.step}
                        </span>
                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>
                          {l.title}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.45,
                          color: 'rgba(238,243,248,.72)',
                          marginTop: 2,
                          textWrap: 'pretty',
                        }}
                      >
                        {i === 2 ? `${deck.code(ladderCourseId)} → ${contact}` : l.body}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                ...mono(11),
                color: 'rgba(238,243,248,.45)',
                borderTop: '1px solid rgba(238,243,248,.12)',
                paddingTop: 10,
              }}
            >
              LOGGED TO OPEN CONCEPTS ·{' '}
              {activeConcept
                ? new Date(activeConcept.openedAt).toLocaleString('en-CA', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                Leave it open
              </button>
              <button
                className="btn btn-primary"
                onClick={() => activeConcept && actions.resolveConcept(activeConcept.id)}
                style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
              >
                Resolved — close concept
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
