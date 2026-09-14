import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { derive } from './lib/deck.js';
import { nowIsoDate, fmtShort } from './lib/dates.js';
import { runScan } from './lib/scanClient.js';
import Triage from './views/Triage.jsx';
import Retrieval from './views/Retrieval.jsx';
import Exams from './views/Exams.jsx';
import WeeklyReview from './views/WeeklyReview.jsx';
import Config from './views/Config.jsx';
import ReviewQueue from './views/ReviewQueue.jsx';
import TermCalendar from './views/TermCalendar.jsx';
import StuckDialog from './components/StuckDialog.jsx';
import ErrorDialog from './components/ErrorDialog.jsx';
import ReviewDialog from './components/ReviewDialog.jsx';
import ResetDialog from './components/ResetDialog.jsx';

const VIEWS = ['triage', 'queue', 'retrieval', 'exams', 'review', 'calendar', 'config'];
const VIEW_LABELS = {
  triage: 'Triage',
  queue: 'Review queue',
  retrieval: 'Retrieval bank',
  exams: 'Exam taper',
  review: 'Sunday review',
  calendar: 'Term calendar',
  config: 'Config',
};

const mono = (size, extra = {}) => ({ fontFamily: 'var(--font-mono)', fontSize: size, ...extra });
const kicker = { ...mono(9), letterSpacing: '.16em', color: 'rgba(238,243,248,.45)' };
const stat = { ...mono(18), lineHeight: 1.15 };

export default function App() {
  const [state, setState] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState('triage');

  const [stuck, setStuck] = useState(null);
  const [stuckDraft, setStuckDraft] = useState({ courseId: 'me524', text: '' });
  const [errorForm, setErrorForm] = useState(null);
  const [reviewStep, setReviewStep] = useState(-1);
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [bankCourseId, setBankCourseId] = useState('me524');
  const [resetOpen, setResetOpen] = useState(false);
  const [scan, setScan] = useState(null);

  const toastTimer = useRef(null);
  const flash = useCallback((message, tone = 'info') => {
    setToast({ message, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5200);
  }, []);

  /* ── load + tick ────────────────────────────────────────────────────── */
  useEffect(() => {
    api
      .getState()
      .then((p) => setState(p.state))
      .catch((e) => setFatal(e.message));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /** Run a mutation; the server hands back the authoritative new state. */
  const run = useCallback(
    async (fn, okMessage) => {
      try {
        const payload = await fn();
        if (payload?.state) setState(payload.state);
        if (okMessage) flash(okMessage);
        return payload;
      } catch (e) {
        flash(e.message, 'error');
        return null;
      }
    },
    [flash]
  );

  const deck = useMemo(() => (state ? derive(state, now) : null), [state, now]);

  /* ── actions ────────────────────────────────────────────────────────── */
  const actions = useMemo(
    () => ({
      setStatus: (id, status) => run(() => api.patchTask(id, { status })),
      patchTask: (id, patch) => run(() => api.patchTask(id, patch)),
      deleteTask: (id) => run(() => api.deleteTask(id)),
      addTask: (body) => run(() => api.addTask(body), 'Added to the deck.'),
      deleteError: (id) => run(() => api.deleteError(id)),
      toggleBlock: (date, courseId) =>
        run(() => api.session({ type: 'practice', date, courseId, minutes: 90, toggle: true })),
      togglePlanned: (date, courseId) =>
        run(() => api.session({ type: 'planned', date, courseId, minutes: 90, toggle: true })),
      patchConcept: (id, patch) => run(() => api.patchConcept(id, patch)),
      resolveConcept: (id) => {
        setStuck(null);
        return run(() => api.patchConcept(id, { status: 'closed' }));
      },
      escalateConcept: (id) => run(() => api.patchConcept(id, { status: 'escalated' })),
      settings: (body) => run(() => api.settings(body)),
      confirmTask: (id, body) => run(() => api.confirmTask(id, body), 'Confirmed.'),
      rejectTask: (id) => run(() => api.rejectTask(id), 'Rejected.'),
      resolveConflict: (id, accept) =>
        run(() => api.resolveConflict(id, accept), accept ? 'Conflict resolved — new date used.' : 'Kept your confirmed date.'),
      saveTermWeeks: (weeks, confirm) =>
        run(() => api.termWeeks(weeks, confirm), confirm ? 'Term calendar confirmed.' : 'Term calendar saved.'),
      openStuckFor: (courseId) => {
        setStuckDraft({ courseId, text: '' });
        setStuck({ phase: 'draft' });
      },
      openErrorFor: (courseId) => {
        const target = deck?.examCourses.some((c) => c.id === courseId) ? courseId : bankCourseId;
        setErrorForm({ courseId: target, topic: '', what: '' });
      },
      setBankCourseId,
    }),
    [run, deck, bankCourseId]
  );

  /* ── stuck timer ────────────────────────────────────────────────────── */
  const openStuck = useCallback(() => {
    if (stuck) return;
    const liveOne = deck?.conceptList.find((c) => c.id === stuck?.conceptId);
    if (liveOne) return;
    setStuck({ phase: 'draft' });
  }, [stuck, deck]);

  const startStuck = useCallback(async () => {
    const mins = Number(state?.settings?.stuckMinutes ?? 25);
    const payload = await run(() =>
      api.addConcept({
        courseId: stuckDraft.courseId,
        description: stuckDraft.text.trim(),
        fromStuckTimer: true,
      })
    );
    if (payload?.id) {
      setStuck({ phase: 'run', conceptId: payload.id, endsAt: Date.now() + mins * 60000 });
    }
  }, [run, state, stuckDraft]);

  /* ── rescan ─────────────────────────────────────────────────────────── */
  const doScan = useCallback(async () => {
    if (scan?.running) return;
    setScan({ running: true, done: 0, total: 0, phase: 'Starting', file: '' });
    try {
      const { summary, state: fresh } = await runScan({
        onPhase: (ev) =>
          setScan((s) => ({ ...s, phase: ev.message, total: ev.total ?? s.total, done: 0 })),
        onProgress: (ev) =>
          setScan((s) => ({ ...s, done: ev.done, total: ev.total, file: ev.file, action: ev.action })),
      });
      if (fresh) setState(fresh);
      setScan({ running: false, summary });
      if (summary?.message) flash(summary.message);
      if (summary && (summary.candidateDates > 0 || summary.conflicts > 0)) setView('queue');
    } catch (e) {
      setScan({ running: false });
      flash(`Scan failed: ${e.message}`, 'error');
    }
  }, [scan, flash]);

  const stuckPhase = useMemo(() => {
    if (!stuck) return null;
    if (stuck.phase === 'run' && now >= stuck.endsAt) return 'ladder';
    return stuck.phase;
  }, [stuck, now]);

  /* ── weekly review ──────────────────────────────────────────────────── */
  const finishReview = useCallback(async () => {
    await run(
      () =>
        api.session({
          type: 'review',
          date: nowIsoDate(now),
          minutes: 20,
          note: reflectionDraft.trim(),
        }),
      'Week closed.'
    );
    setReviewStep(-1);
    setReflectionDraft('');
  }, [run, reflectionDraft, now]);

  /* ── keyboard ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target || {};
      const tag = String(t.tagName || '').toLowerCase();
      const typing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
      if (e.key === 'Escape') {
        setStuck(null);
        setErrorForm(null);
        setReviewStep(-1);
        setResetOpen(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        openStuck();
      } else if (k === 'e') {
        e.preventDefault();
        setErrorForm({ courseId: bankCourseId, topic: '', what: '' });
      } else if (k === 'w') {
        e.preventDefault();
        setView('review');
        setReviewStep(0);
      } else if (k === 'r') {
        e.preventDefault();
        doScan();
      } else if ('1234567'.includes(e.key)) {
        setView(VIEWS[Number(e.key) - 1]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openStuck, bankCourseId, doScan]);

  /* ── render ─────────────────────────────────────────────────────────── */
  if (fatal) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--sig)' }}>
        <div style={{ letterSpacing: '.12em', marginBottom: 10 }}>DECK SERVER UNREACHABLE</div>
        <div style={{ color: 'rgba(238,243,248,.7)', lineHeight: 1.6 }}>
          {fatal}
          <br />
          <br />
          Start it with <span style={{ color: 'var(--color-accent)' }}>npm run dev</span> from the
          StudyHub folder.
        </div>
      </div>
    );
  }

  const h = deck?.header;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: '#151f29',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 24,
            padding: '13px 20px 11px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ marginRight: 'auto' }}>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: 20,
                letterSpacing: '.03em',
                lineHeight: 1,
              }}
            >
              TERM COMMAND DECK
            </div>
            <div style={{ ...mono(10), letterSpacing: '.15em', color: 'var(--color-accent)', marginTop: 4 }}>
              {h ? h.termLabel : 'FALL 2026 · 4A MECHANICAL'}
            </div>
          </div>

          {h && (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={kicker}>DAY</div>
                <div style={stat}>{h.dayStr}</div>
              </div>
              <div>
                <div style={kicker}>WEEK</div>
                <div style={stat}>{h.weekStr}</div>
              </div>
              <div>
                <div style={kicker}>UNBANKED</div>
                <div style={{ ...stat, color: 'var(--sig)' }}>{h.unbankedStr}</div>
              </div>
              <div>
                <div style={kicker}>ERROR LOG</div>
                <div style={{ ...stat, color: 'var(--color-accent)' }}>{h.errorTotalStr}</div>
              </div>
              <div>
                <div style={kicker}>PRACTICE</div>
                <div style={stat}>{h.practiceStreakStr}</div>
              </div>
              <div>
                <div style={kicker}>REVIEWS</div>
                <div style={stat}>{h.reviewStreakStr}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flex: 'none' }}>
            <button
              className="btn btn-secondary"
              onClick={doScan}
              disabled={!!scan?.running}
              style={{
                fontSize: 12.5,
                letterSpacing: '.08em',
                padding: '7px 12px',
                gap: 8,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{scan?.running ? 'SCANNING…' : 'RESCAN'}</span>
              <span style={{ ...mono(10), border: '1px solid var(--color-divider)', padding: '0 4px' }}>R</span>
            </button>
            <span style={{ ...mono(9.5), letterSpacing: '.08em', color: 'rgba(238,243,248,.4)' }}>
              {scan?.running
                ? scan.total
                  ? `${scan.done}/${scan.total}`
                  : 'starting'
                : lastScanLabel(state?.settings?.lastScannedAt)}
            </span>
          </div>

          <button
            className="btn btn-primary"
            onClick={openStuck}
            style={{
              fontSize: 13,
              letterSpacing: '.08em',
              padding: '9px 14px',
              gap: 9,
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            <span>
              {h && h.openConceptCount && !stuck
                ? `I'M STUCK · ${h.openConceptCount} OPEN`
                : "I'M STUCK"}
            </span>
            <span style={{ ...mono(10), border: '1px solid rgba(21,31,41,.35)', padding: '0 4px' }}>
              S
            </span>
          </button>
        </div>

        <div style={{ height: 2, background: 'rgba(238,243,248,.1)' }}>
          {h && <div style={h.termBarStyle} />}
        </div>

        {scan?.running && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '6px 20px',
              background: 'rgba(148,188,227,.08)',
              borderBottom: '1px solid var(--color-divider)',
              ...mono(11),
            }}
          >
            <span style={{ color: 'var(--color-accent)', letterSpacing: '.1em', whiteSpace: 'nowrap' }}>
              {scan.phase}
            </span>
            <div style={{ flex: 1, minWidth: 60, height: 3, background: 'rgba(238,243,248,.12)' }}>
              <div
                style={{
                  width: scan.total ? `${Math.round((scan.done / scan.total) * 100)}%` : '18%',
                  height: '100%',
                  background: 'var(--color-accent)',
                  transition: 'width .12s linear',
                }}
              />
            </div>
            <span style={{ color: 'rgba(238,243,248,.55)', whiteSpace: 'nowrap' }}>
              {scan.total ? `${scan.done} / ${scan.total}` : ''}
            </span>
            <span
              style={{
                color: 'rgba(238,243,248,.4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 320,
              }}
            >
              {scan.file}
            </span>
          </div>
        )}

        <nav style={{ display: 'flex', gap: 4, padding: '0 18px', flexWrap: 'wrap' }}>
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: 0,
                padding: '11px 10px 9px',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: 13.5,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                position: 'relative',
                whiteSpace: 'nowrap',
                color: view === v ? 'var(--color-accent)' : 'rgba(238,243,248,.5)',
              }}
            >
              {VIEW_LABELS[v]}
              {v === 'queue' && deck?.reviewQueue.length > 0 && (
                <span
                  style={{
                    ...mono(9.5),
                    marginLeft: 6,
                    background: deck.conflictRows.length ? 'var(--sig)' : 'var(--color-accent)',
                    color: '#151f29',
                    padding: '1px 5px',
                    letterSpacing: '.06em',
                  }}
                >
                  {deck.reviewQueue.length}
                </span>
              )}
              {view === v && (
                <span
                  style={{
                    position: 'absolute',
                    left: 6,
                    right: 6,
                    bottom: -1,
                    height: 2,
                    background: 'var(--color-accent)',
                  }}
                />
              )}
            </button>
          ))}
        </nav>
      </header>

      {toast && (
        <div
          style={{
            padding: '8px 20px',
            ...mono(11.5),
            letterSpacing: '.06em',
            background: toast.tone === 'error' ? 'rgba(226,145,63,.14)' : 'rgba(148,188,227,.12)',
            color: toast.tone === 'error' ? 'var(--sig)' : 'var(--color-accent)',
            borderBottom: '1px solid var(--color-divider)',
          }}
        >
          {toast.message}
        </div>
      )}

      <main style={{ flex: 1, padding: '20px 20px 30px' }}>
        {!deck && (
          <div
            style={{
              ...mono(12),
              letterSpacing: '.1em',
              color: 'var(--color-accent)',
              padding: '40px 0',
              animation: 'blip 1.1s infinite',
            }}
          >
            LOADING DECK STATE …
          </div>
        )}

        {deck && view === 'triage' && (
          <Triage
            deck={deck}
            actions={actions}
            showDone={showDone}
            onToggleDone={() => setShowDone((s) => !s)}
            onGoConfig={() => setView('config')}
            onOpenLadder={(id) => setStuck({ phase: 'ladder', conceptId: id, endsAt: 0 })}
          />
        )}
        {deck && view === 'retrieval' && (
          <Retrieval
            deck={deck}
            actions={actions}
            bankCourseId={bankCourseId}
            onOpenError={() => setErrorForm({ courseId: bankCourseId, topic: '', what: '' })}
          />
        )}
        {deck && view === 'exams' && <Exams deck={deck} />}
        {deck && view === 'review' && (
          <WeeklyReview deck={deck} onStart={() => setReviewStep(0)} />
        )}
        {deck && view === 'queue' && <ReviewQueue deck={deck} actions={actions} />}
        {deck && view === 'calendar' && <TermCalendar deck={deck} actions={actions} />}
        {deck && view === 'config' && <Config deck={deck} actions={actions} onAskReset={() => setResetOpen(true)} />}
      </main>

      <footer
        style={{
          borderTop: '1px solid var(--color-divider)',
          padding: '10px 20px',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          ...mono(10.5),
          letterSpacing: '.08em',
          color: 'rgba(238,243,248,.4)',
        }}
      >
        <span>S — STUCK TIMER</span>
        <span>E — LOG ERROR</span>
        <span>W — WEEKLY REVIEW</span>
        <span>R — RESCAN</span>
        <span>1–7 — VIEWS</span>
        <span>ESC — CLOSE</span>
        <span style={{ marginLeft: 'auto' }}>
          SQLITE · {state?.meta?.dbPath?.split(/[\\/]/).pop() || 'deck.db'}
        </span>
      </footer>

      {deck && stuck && (
        <StuckDialog
          deck={deck}
          phase={stuckPhase}
          stuck={stuck}
          draft={stuckDraft}
          setDraft={setStuckDraft}
          minutes={Number(state?.settings?.stuckMinutes ?? 25)}
          now={now}
          onStart={startStuck}
          onClose={() => setStuck(null)}
          onEscalateNow={() =>
            setStuck((s) => ({ phase: 'ladder', conceptId: s.conceptId, endsAt: 0 }))
          }
          actions={actions}
        />
      )}

      {deck && errorForm && (
        <ErrorDialog
          deck={deck}
          form={errorForm}
          setForm={setErrorForm}
          onClose={() => setErrorForm(null)}
          onSave={async () => {
            const f = errorForm;
            if (!f.what.trim() && !f.topic.trim()) return setErrorForm(null);
            await run(() =>
              api.addError({ courseId: f.courseId, topic: f.topic, whatIGotWrong: f.what })
            );
            setBankCourseId(f.courseId);
            setErrorForm(null);
          }}
        />
      )}

      {deck && reviewStep >= 0 && (
        <ReviewDialog
          deck={deck}
          step={reviewStep}
          setStep={setReviewStep}
          actions={actions}
          reflectionDraft={reflectionDraft}
          setReflectionDraft={setReflectionDraft}
          onClose={() => setReviewStep(-1)}
          onFinish={finishReview}
        />
      )}

      {resetOpen && (
        <ResetDialog
          onCancel={() => setResetOpen(false)}
          onConfirm={async () => {
            await run(() => api.reset(), 'Deck reset to the seeded term.');
            setResetOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** "scanned 4m ago" — the freshness of the deck, next to the Rescan button. */
function lastScanLabel(iso) {
  if (!iso) return 'never scanned';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'never scanned';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'scanned just now';
  if (mins < 60) return `scanned ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `scanned ${hrs}h ago`;
  return `scanned ${fmtShort(iso.slice(0, 10))}`;
}
