import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun,
  ListOrdered,
  Telescope,
  Inbox,
  Brain,
  GraduationCap,
  NotebookPen,
  CalendarDays,
  SlidersHorizontal,
  RefreshCw,
  LifeBuoy,
  Smartphone,
} from 'lucide-react';
import { api } from './api.js';
import { derive } from './lib/deck.js';
import { nowIsoDate, fmtShort } from './lib/dates.js';
import { runScan } from './lib/scanClient.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress, Kbd } from '@/components/ui/misc';
import Today from './views/Today.jsx';
import Triage from './views/Triage.jsx';
import Outlook from './views/Outlook.jsx';
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

// Order is the keyboard order: 1–9.
const VIEWS = [
  { id: 'today', label: 'Today', icon: Sun, subtitle: 'Your study window, minus your classes, filled from the triage ranking.' },
  { id: 'triage', label: 'Triage', icon: ListOrdered, subtitle: 'Everything open, most urgent first.' },
  { id: 'outlook', label: 'Outlook', icon: Telescope, subtitle: 'Whether each exam gets enough prep, and which weeks will be crushed.' },
  { id: 'queue', label: 'Review queue', icon: Inbox, subtitle: 'Scanned dates wait here until you confirm them. Nothing unconfirmed reaches your plan.' },
  { id: 'retrieval', label: 'Retrieval', icon: Brain, subtitle: 'Practice blocks and the error log — the material every exam taper is built from.' },
  { id: 'exams', label: 'Exam taper', icon: GraduationCap, subtitle: 'Back-planned from each confirmed exam date.' },
  { id: 'review', label: 'Sunday review', icon: NotebookPen, subtitle: 'Twenty minutes a week. The habit that holds the rest together.' },
  { id: 'calendar', label: 'Term calendar', icon: CalendarDays, subtitle: 'Week numbers to dates. Every “Friday of Week 5” resolves against this.' },
  { id: 'config', label: 'Config', icon: SlidersHorizontal, subtitle: 'Weights, estimates, dates, your timetable and study window.' },
];
const VIEW_BY_ID = Object.fromEntries(VIEWS.map((v) => [v.id, v]));

export default function App() {
  const [state, setState] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState('today');

  const [stuck, setStuck] = useState(null);
  const [stuckDraft, setStuckDraft] = useState({ courseId: 'mse331', text: '' });
  const [errorForm, setErrorForm] = useState(null);
  const [reviewStep, setReviewStep] = useState(-1);
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [bankCourseId, setBankCourseId] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [scan, setScan] = useState(null);

  const toastTimer = useRef(null);
  const flash = useCallback((message, tone = 'info') => {
    setToast({ message, tone, key: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
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

  // The error bank defaults to the first exam course rather than a hardcoded
  // one, so a change of courses cannot leave it pointing at nothing.
  const bankId = bankCourseId && deck?.examCourses.some((c) => c.id === bankCourseId)
    ? bankCourseId
    : deck?.examCourses[0]?.id || null;

  /* ── actions ────────────────────────────────────────────────────────── */
  const actions = useMemo(
    () => ({
      setStatus: (id, status) => run(() => api.patchTask(id, { status })),
      toggleSlot: (date, slot) =>
        run(() =>
          api.toggleSlot({
            date,
            slotKey: slot.key,
            courseId: slot.courseId || null,
            taskId: slot.taskId || null,
            minutes: slot.minutes,
          })
        ),
      saveClassBlocks: (blocks) => run(() => api.classBlocks(blocks), 'Timetable saved.'),
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
        const target = deck?.examCourses.some((c) => c.id === courseId) ? courseId : bankId;
        setErrorForm({ courseId: target, topic: '', what: '' });
      },
      setBankCourseId,
    }),
    [run, deck, bankId]
  );

  /* ── stuck timer ────────────────────────────────────────────────────── */
  const openStuck = useCallback(() => {
    if (stuck) return;
    setStuck({ phase: 'draft' });
  }, [stuck]);

  const startStuck = useCallback(async () => {
    const mins = Number(state?.settings?.stuckMinutes ?? 25);
    // A draft can name a course that has since been dropped; fall back to the
    // first course the deck still has, which is also what the dialog shows.
    const courseId = deck?.courses.some((c) => c.id === stuckDraft.courseId)
      ? stuckDraft.courseId
      : deck?.courses[0]?.id;
    const payload = await run(() =>
      api.addConcept({
        courseId,
        description: stuckDraft.text.trim(),
        fromStuckTimer: true,
      })
    );
    if (payload?.id) {
      setStuck({ phase: 'run', conceptId: payload.id, endsAt: Date.now() + mins * 60000 });
    }
  }, [run, state, stuckDraft, deck]);

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
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      // Dialogs own the keyboard while they are open.
      if (stuck || errorForm || reviewStep >= 0 || resetOpen) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        openStuck();
      } else if (k === 'e') {
        e.preventDefault();
        setErrorForm({ courseId: bankId, topic: '', what: '' });
      } else if (k === 'w') {
        e.preventDefault();
        setView('review');
        setReviewStep(0);
      } else if (k === 'r') {
        e.preventDefault();
        doScan();
      } else if (/^[1-9]$/.test(e.key)) {
        setView(VIEWS[Number(e.key) - 1].id);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openStuck, bankId, doScan, stuck, errorForm, reviewStep, resetOpen]);

  /* ── render ─────────────────────────────────────────────────────────── */
  if (fatal) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md rounded-3xl bg-card p-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-ios-orange/15 text-tint-orange">
            <RefreshCw className="size-6" />
          </div>
          <h1 className="text-title-3 font-semibold">The deck server isn’t running</h1>
          <p className="mt-2 text-subhead text-muted-foreground">{fatal}</p>
          <p className="mt-4 text-subhead text-muted-foreground">
            Open it from the <b className="text-foreground">Term Command Deck</b> shortcut on your desktop, or run{' '}
            <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-footnote">npm run dev</code> in the
            StudyHub folder.
          </p>
        </div>
      </div>
    );
  }

  const h = deck?.header;
  const meta = VIEW_BY_ID[view];
  const queueCount = deck?.reviewQueue.length || 0;
  const scanPct = scan?.running && scan.total ? Math.round((scan.done / scan.total) * 100) : 0;

  return (
    <div className="flex min-h-screen">
      {/* ── sidebar ─────────────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-card/60 px-3 pb-4 pt-6 lg:flex">
        <div className="px-3">
          <div className="font-display text-title-3 font-bold tracking-tight">Term Command Deck</div>
          <div className="mt-0.5 text-footnote text-muted-foreground">
            {h ? `Fall 2026 · Week ${h.weekNo === 'RD' ? '— reading' : `${Number(h.weekNo)} of ${h.lectureWeeks}`}` : 'Fall 2026'}
          </div>
          {h && <Progress value={h.termPct} className="mt-3 h-1" />}
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Views">
          {VIEWS.map((v, i) => {
            const Icon = v.icon;
            const on = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'group flex h-9 items-center gap-3 rounded-[10px] px-3 text-subhead font-medium transition-colors',
                  on ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'
                )}
              >
                <Icon className={cn('size-[18px] shrink-0', on ? '' : 'text-tint-blue')} strokeWidth={2} />
                <span className="flex-1 text-left">{v.label}</span>
                {v.id === 'queue' && queueCount > 0 && (
                  <span
                    className={cn(
                      'min-w-5 rounded-full px-1.5 text-center text-caption font-semibold tabular',
                      on ? 'bg-white/25 text-white' : deck.conflictRows.length ? 'bg-ios-orange text-white' : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {queueCount}
                  </span>
                )}
                <span className={cn('text-caption-2 tabular', on ? 'text-white/70' : 'text-label-3')}>{i + 1}</span>
              </button>
            );
          })}
        </nav>

        {h && (
          <div className="mx-1 grid grid-cols-2 gap-x-3 gap-y-3 rounded-2xl bg-card p-4">
            <MiniStat label="Day" value={h.dayStr} />
            <MiniStat label="Unbanked" value={h.unbankedStr} tone="orange" />
            <MiniStat label="Errors" value={h.errorTotalStr} tone="blue" />
            <MiniStat label="Practice" value={h.practiceStreakStr} />
            <MiniStat label="Reviews" value={h.reviewStreakStr} />
            <MiniStat label="Stuck" value={h.openConceptCount || '0'} tone={h.openConceptCount ? 'orange' : undefined} />
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 px-3 text-caption text-muted-foreground">
          <PhoneSyncLine sync={state?.meta?.phoneSync} />
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1"><Kbd>S</Kbd> stuck</span>
            <span className="inline-flex items-center gap-1"><Kbd>E</Kbd> error</span>
            <span className="inline-flex items-center gap-1"><Kbd>W</Kbd> review</span>
            <span className="inline-flex items-center gap-1"><Kbd>R</Kbd> rescan</span>
          </div>
        </div>
      </aside>

      {/* ── main ────────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="material sticky top-0 z-30 border-b border-border">
          <div className="flex items-center gap-3 px-5 py-2.5 sm:px-8">
            {/* Narrow windows lose the sidebar; the views move up here. */}
            <nav className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto lg:hidden" aria-label="Views">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={cn(
                    'h-8 shrink-0 rounded-full px-3 text-footnote font-semibold',
                    view === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {v.label}
                </button>
              ))}
            </nav>
            <div className="hidden min-w-0 flex-1 truncate text-footnote text-muted-foreground lg:block">
              {scan?.running
                ? `${scan.phase}${scan.total ? ` · ${scan.done} of ${scan.total}` : ''}`
                : lastScanLabel(state?.settings?.lastScannedAt)}
            </div>
            <Button variant="gray" onClick={doScan} disabled={!!scan?.running} className="shrink-0">
              <RefreshCw className={cn(scan?.running && 'animate-spin')} />
              {scan?.running ? 'Scanning' : 'Rescan'}
            </Button>
            <Button onClick={openStuck} className="shrink-0">
              <LifeBuoy />
              I’m stuck
              {h?.openConceptCount > 0 && !stuck && (
                <span className="rounded-full bg-white/25 px-1.5 text-caption tabular">{h.openConceptCount}</span>
              )}
            </Button>
          </div>
          {scan?.running && (
            <div className="px-5 pb-2 sm:px-8">
              <Progress value={scan.total ? scanPct : 12} className="h-1" />
              {scan.file && <div className="mt-1 truncate text-caption text-muted-foreground">{scan.file}</div>}
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 pb-16 pt-7 sm:px-8">
          <div className="mb-6">
            <h1 className="font-display text-large-title font-bold tracking-tight">{meta.label}</h1>
            <p className="mt-1 max-w-3xl text-subhead text-muted-foreground text-pretty">{meta.subtitle}</p>
          </div>

          {!deck && <div className="animate-blip text-subhead text-muted-foreground">Loading your deck…</div>}

          {deck && view === 'today' && (
            <Today
              deck={deck}
              actions={actions}
              now={now}
              onGoQueue={() => setView('queue')}
              onGoConfig={() => setView('config')}
            />
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
          {deck && view === 'outlook' && <Outlook deck={deck} onGoConfig={() => setView('config')} />}
          {deck && view === 'retrieval' && (
            <Retrieval
              deck={deck}
              actions={actions}
              bankCourseId={bankId}
              onOpenError={() => setErrorForm({ courseId: bankId, topic: '', what: '' })}
            />
          )}
          {deck && view === 'exams' && <Exams deck={deck} />}
          {deck && view === 'review' && <WeeklyReview deck={deck} onStart={() => setReviewStep(0)} />}
          {deck && view === 'queue' && <ReviewQueue deck={deck} actions={actions} />}
          {deck && view === 'calendar' && <TermCalendar deck={deck} actions={actions} />}
          {deck && view === 'config' && (
            <Config deck={deck} actions={actions} onAskReset={() => setResetOpen(true)} />
          )}
        </main>
      </div>

      {/* ── toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div
          key={toast.key}
          role="status"
          className={cn(
            'material fixed left-1/2 top-4 z-[60] max-w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-full px-5 py-2.5 text-subhead font-medium shadow-lg shadow-black/10',
            'animate-in fade-in-0 slide-in-from-top-2',
            toast.tone === 'error' ? 'text-tint-red' : 'text-foreground'
          )}
        >
          {toast.message}
        </div>
      )}

      {deck && (
        <StuckDialog
          open={!!stuck}
          deck={deck}
          phase={stuckPhase}
          stuck={stuck || {}}
          draft={stuckDraft}
          setDraft={setStuckDraft}
          minutes={Number(state?.settings?.stuckMinutes ?? 25)}
          now={now}
          onStart={startStuck}
          onClose={() => setStuck(null)}
          onEscalateNow={() => setStuck((s) => ({ phase: 'ladder', conceptId: s.conceptId, endsAt: 0 }))}
          actions={actions}
        />
      )}

      {deck && (
        <ErrorDialog
          open={!!errorForm}
          deck={deck}
          form={errorForm || { courseId: bankId, topic: '', what: '' }}
          setForm={setErrorForm}
          onClose={() => setErrorForm(null)}
          onSave={async () => {
            const f = errorForm;
            if (!f.what.trim() && !f.topic.trim()) return setErrorForm(null);
            await run(() => api.addError({ courseId: f.courseId, topic: f.topic, whatIGotWrong: f.what }), 'Error banked.');
            setBankCourseId(f.courseId);
            setErrorForm(null);
          }}
        />
      )}

      {deck && (
        <ReviewDialog
          open={reviewStep >= 0}
          deck={deck}
          step={Math.max(0, reviewStep)}
          setStep={setReviewStep}
          actions={actions}
          reflectionDraft={reflectionDraft}
          setReflectionDraft={setReflectionDraft}
          onClose={() => setReviewStep(-1)}
          onFinish={finishReview}
        />
      )}

      <ResetDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          await run(() => api.reset(), 'Deck reset to the seeded term.');
          setResetOpen(false);
        }}
      />
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <div className="text-caption-2 font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-display text-headline font-semibold tabular',
          tone === 'orange' ? 'text-tint-orange' : tone === 'blue' ? 'text-tint-blue' : 'text-foreground'
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Whether the phone copy is current. Silent when phone sync is off. */
function PhoneSyncLine({ sync }) {
  if (!sync?.enabled) return null;
  const ok = !sync.lastError;
  return (
    <div className={cn('flex items-center gap-1.5', ok ? '' : 'text-tint-orange')} title={sync.lastError || ''}>
      <Smartphone className="size-3.5" />
      {ok
        ? sync.lastSyncAt
          ? `iPhone up to date · ${ago(sync.lastSyncAt)}`
          : 'iPhone · waiting for first sync'
        : 'iPhone sync failing — hover for why'}
    </div>
  );
}

function ago(iso) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : fmtShort(iso.slice(0, 10));
}

/** "Scanned 4m ago" — the freshness of the deck, beside the Rescan button. */
function lastScanLabel(iso) {
  if (!iso) return 'Never scanned';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'Never scanned';
  return `Course files scanned ${ago(iso)}`;
}
