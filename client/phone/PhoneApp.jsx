import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sun, ListOrdered, Telescope, RefreshCw, CircleUserRound, LogOut, CloudOff } from 'lucide-react';
import { derive } from '@/lib/deck.js';
import { fmtShort, iso } from '@/lib/dates.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import Today from '@/views/Today.jsx';
import Triage from '@/views/Triage.jsx';
import { AttentionCallouts, ExamReadiness, WeekChart, FlaggedWeeks } from '@/views/Outlook.jsx';

// The phone is for looking, not editing: dates go in on the laptop. So three
// tabs, the three questions you ask away from your desk —
//   Today    what am I doing right now, and next?
//   Triage   what is most urgent?
//   Outlook  what is coming that I should be worried about?
const TABS = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'triage', label: 'Triage', icon: ListOrdered },
  { id: 'outlook', label: 'Outlook', icon: Telescope },
];

const NO_ACTIONS = {};
const noop = () => {};

async function api(path, init) {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* an empty or non-JSON body is reported by status below */
  }
  return { status: res.status, body };
}

export default function PhoneApp() {
  const [session, setSession] = useState({ status: 'checking' });
  const [snap, setSnap] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [accountOpen, setAccountOpen] = useState(false);
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('deck-tab') || 'today';
    } catch {
      return 'today';
    }
  });

  const chooseTab = (id) => {
    setTab(id);
    window.scrollTo({ top: 0 });
    try {
      localStorage.setItem('deck-tab', id);
    } catch {
      /* private browsing: the tab just won't be remembered */
    }
  };

  /* ── session ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    api('/api/session').then(({ status, body }) =>
      setSession(status === 200 ? { status: 'in', user: body.user } : { status: 'out' })
    );
  }, []);

  /* ── data ─────────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { status, body } = await api('/api/snapshot');
      if (status === 401) {
        setSession({ status: 'out' });
        return;
      }
      if (status !== 200) {
        setLoadError(body?.error || `Could not load (${status}).`);
        return;
      }
      setSnap(body);
      setLoadError(null);
    } catch {
      setLoadError('No connection. Showing the last copy loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== 'in') return;
    load();
    // Coming back to the app is when a fresher copy matters most.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(() => document.visibilityState === 'visible' && load(), 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(poll);
    };
  }, [session.status, load]);

  // The plan is recomputed here from the phone's own clock, so "right now"
  // is right even if the laptop last synced yesterday. Every 30 s is plenty.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const deck = useMemo(() => (snap ? derive(snap, now) : null), [snap, now]);

  const signOut = async () => {
    await api('/api/logout', { method: 'POST' });
    setAccountOpen(false);
    setSnap(null);
    setSession({ status: 'out' });
  };

  /* ── render ───────────────────────────────────────────────────────────── */
  if (session.status === 'checking') {
    return <div className="grid min-h-dvh place-items-center text-subhead text-muted-foreground">Loading…</div>;
  }
  if (session.status === 'out') {
    return <SignIn onSignedIn={(user) => setSession({ status: 'in', user })} />;
  }

  const syncedAt = snap?.syncedAt ? Date.parse(snap.syncedAt) : null;
  const staleHours = syncedAt ? (now - syncedAt) / 3600000 : null;
  const current = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+5rem)]">
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex h-9 items-center justify-between gap-2">
          <button
            onClick={load}
            className="flex min-w-0 items-center gap-1.5 text-footnote text-muted-foreground"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('size-3.5 shrink-0', loading && 'animate-spin')} />
            <span className="truncate">{syncedAt ? `Synced ${ago(syncedAt, now)}` : 'Not synced yet'}</span>
          </button>
          <Button variant="plain" size="icon" aria-label="Account" onClick={() => setAccountOpen(true)}>
            <CircleUserRound className="size-6" />
          </Button>
        </div>
        <h1 className="mt-1 font-display text-large-title font-bold tracking-tight">{current.label}</h1>
      </header>

      <main className="flex flex-col gap-6 px-4 pt-4">
        {loadError && (
          <Callout tone="orange" icon={CloudOff}>
            {loadError}
          </Callout>
        )}
        {staleHours != null && staleHours > 36 && (
          <Callout tone="orange" icon={CloudOff} title="This copy is getting old">
            The laptop last synced {fmtShort(iso(new Date(syncedAt)))}. Open the deck on the laptop and it will
            update this within a few seconds.
          </Callout>
        )}

        {!deck && !loadError && <div className="animate-blip text-subhead text-muted-foreground">Loading your plan…</div>}

        {deck && tab === 'today' && <Today deck={deck} actions={NO_ACTIONS} now={now} readOnly />}
        {deck && tab === 'triage' && (
          <Triage
            deck={deck}
            actions={NO_ACTIONS}
            showDone={false}
            onToggleDone={noop}
            onGoConfig={noop}
            onOpenLadder={noop}
            readOnly
          />
        )}
        {deck && tab === 'outlook' && (
          <>
            <AttentionCallouts deck={deck} />
            <ExamReadiness deck={deck} />
            <WeekChart outlook={deck.outlook} />
            <FlaggedWeeks outlook={deck.outlook} />
          </>
        )}
      </main>

      {/* ── the tab bar ─────────────────────────────────────────────────── */}
      <nav
        aria-label="Sections"
        className="material fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-md grid-cols-3">
          {TABS.map((t) => {
            const on = t.id === tab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => chooseTab(t.id)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex h-[52px] flex-col items-center justify-center gap-0.5 text-caption-2 font-medium',
                  on ? 'text-tint-blue' : 'text-muted-foreground'
                )}
              >
                <Icon className="size-6" strokeWidth={on ? 2.3 : 1.8} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="w-[min(380px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Signed in as {session.user}</DialogTitle>
            <DialogDescription>
              {syncedAt
                ? `This is a read-only copy of your deck, last synced from the laptop ${ago(syncedAt, now)}.`
                : 'The laptop has not synced a copy yet.'}{' '}
              Dates and ticks are changed on the laptop.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="gray" size="lg" onClick={() => { setAccountOpen(false); load(); }}>
              <RefreshCw />
              Refresh now
            </Button>
            <Button variant="destructive" size="lg" onClick={signOut}>
              <LogOut />
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── sign in ─────────────────────────────────────────────────────────────── */

function SignIn({ onSignedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      const { status, body } = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (status === 200) onSignedIn(body.user);
      else setError(body?.error || `Could not sign in (${status}).`);
    } catch {
      setError('No connection. Check your signal and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-5 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <form onSubmit={submit} className="w-full max-w-sm">
        <img src="/apple-touch-icon.png" alt="" className="mx-auto size-20 rounded-[22.5%] shadow-lg shadow-primary/25" />
        <h1 className="mt-5 text-center font-display text-title-1 font-bold">Term Command Deck</h1>
        <p className="mt-1 text-center text-subhead text-muted-foreground">Sign in to see today’s plan.</p>

        {/* Username and password as one inset-grouped plate, as iOS does it. */}
        <div className="mt-8 overflow-hidden rounded-xl bg-card">
          <label className="sr-only" htmlFor="u">Username</label>
          <input
            id="u"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-12 w-full bg-transparent px-4 text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="ml-4 h-px bg-border" />
          <label className="sr-only" htmlFor="p">Password</label>
          <input
            id="p"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full bg-transparent px-4 text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 px-4 text-footnote text-tint-red">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || !username || !password}>
          {busy ? 'Signing in…' : 'Sign In'}
        </Button>
        <p className="mt-6 text-center text-caption text-muted-foreground">
          In Safari, tap Share → Add to Home Screen to open this like an app.
        </p>
      </form>
    </div>
  );
}

function ago(ms, now) {
  const mins = Math.round((now - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  // Local date, not toISOString(): in Toronto an evening sync is already
  // tomorrow in UTC.
  return fmtShort(iso(new Date(ms)));
}
