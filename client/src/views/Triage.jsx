import React from 'react';
import { Check, LifeBuoy, PenLine, Undo2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress, CheckCircle, Stat, Callout } from '@/components/ui/misc';
import { ListSection, ListRow } from '@/components/ui/list';

/** Group consecutive rows by ranking tier, keeping the rank order. */
function byTier(rows) {
  const groups = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.tier === r.tier) last.rows.push(r);
    else groups.push({ tier: r.tier, label: r.tierLabel, rows: [r] });
  }
  return groups;
}

const TIER_FOOTER = {
  0: 'Ranked by slack: days left, minus the days of work still needed at your focus pace. Tightest first.',
  1: 'Ranked by priority: (marks/hour × 10) + (30 ÷ days left), −5 if droppable.',
  2: 'No confirmed date. Ranked by priority, below anything with a real deadline.',
  3: 'Due beyond the planning horizon. Pulled forward only into blocks past your daily target.',
};

export default function Triage({ deck, actions, showDone, onToggleDone, onGoConfig, onOpenLadder, readOnly = false }) {
  const { triage, stake, horizonList, conceptList, weekBlocks, blindSpots, rules } = deck;
  const top = triage.top;
  const slipDays = Number(deck.settings.slipDays ?? 3);
  const groups = byTier(triage.rest);

  return (
    <div className={cn('grid items-start gap-8', !readOnly && 'xl:grid-cols-[minmax(0,1fr)_340px]')}>
      {/* ── queue ───────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-7">
        {top ? (
          <Card className="ring-2 ring-ios-orange/60">
            <div className="flex flex-wrap gap-6 p-6">
              <div className="min-w-0 flex-[1_1_320px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="solid-orange">Work on this now</Badge>
                  <span className="text-subhead font-semibold text-tint-blue">{top.course}</span>
                  {top.isExam && <Badge tone="orange">Exam prep</Badge>}
                </div>
                <h2 className="mt-3 font-display text-title-1 font-bold text-balance">{top.title}</h2>
                <p className="mt-2 text-subhead text-muted-foreground">{top.reason}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {top.isTrap && (
                    <Callout tone="orange">Low marks, high exam value — treat it as exam prep.</Callout>
                  )}
                  {top.isFree && <Callout tone="blue">Cheap marks — never skip.</Callout>}
                  {top.hasNote && <p className="text-footnote text-muted-foreground text-pretty">{top.note}</p>}
                </div>
                {!readOnly && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => actions.setStatus(top.id, 'done')}>
                    <Check />
                    Mark submitted
                  </Button>
                  <Button variant="tinted" onClick={() => actions.openStuckFor(top.courseId)}>
                    <LifeBuoy />
                    Start stuck timer
                  </Button>
                  <Button variant="plain" onClick={() => actions.openErrorFor(top.courseId)}>
                    <PenLine />
                    Log an error
                  </Button>
                </div>
                )}
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 self-start">
                <Stat label="Weight" value={top.weightStr} size="lg" />
                <Stat label={top.rankLabel === 'SLACK' ? 'Slack' : 'Priority'} value={top.rankStr} size="lg" tone="orange" />
                <Stat label="Estimate" value={top.estStr} size="sm" />
                <Stat label="Due" value={top.dueStr} sub={top.daysStr} size="sm" />
              </div>
            </div>
          </Card>
        ) : (
          <Callout tone="green" title="Queue empty">
            Everything with a due date is submitted. Go bank retrieval practice.
          </Callout>
        )}

        {groups.map((g) => (
          <ListSection
            key={g.tier}
            header={g.label}
            tone={g.tier === 0 ? 'orange' : undefined}
            footer={TIER_FOOTER[g.tier]}
          >
            {g.rows.map((r) => (
              <ListRow key={r.id} className="items-start py-3" style={{ '--sep-inset': '3.25rem' }}>
                <span className="w-6 shrink-0 pt-0.5 text-right text-footnote text-label-3 tabular">{Number(r.rank)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-footnote font-semibold text-tint-blue">{r.course}</span>
                    <span className="text-subhead font-semibold">{r.title}</span>
                    {r.isExam && <Badge tone="orange">Exam</Badge>}
                    {r.isTrap && <Badge tone="orange">Trap</Badge>}
                    {r.isFree && <Badge tone="blue">Cheap marks</Badge>}
                  </div>
                  <p className="mt-1 text-footnote text-muted-foreground text-pretty">{r.reason}</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <div className="text-subhead font-semibold tabular">{r.weightStr}</div>
                  <div className="text-caption text-muted-foreground tabular">{r.estStr}</div>
                </div>
                <div className={cn('w-24 shrink-0 text-right', readOnly && 'hidden sm:block')}>
                  <div className="text-footnote font-medium tabular">{r.dueStr}</div>
                  <div className={cn('text-caption tabular', r.tier === 0 ? 'text-tint-orange' : 'text-muted-foreground')}>
                    {r.daysStr}
                  </div>
                </div>
                <div className="w-14 shrink-0 text-right">
                  <div className={cn('text-subhead font-semibold tabular', r.tier === 0 ? 'text-tint-orange' : 'text-foreground')}>
                    {r.rankStr}
                  </div>
                  <div className="text-caption-2 uppercase tracking-wide text-muted-foreground">{r.rankLabel === 'SLACK' ? 'slack' : 'priority'}</div>
                </div>
                {!readOnly && (
                  <CheckCircle label={`Mark ${r.title} submitted`} onClick={() => actions.setStatus(r.id, 'done')} className="mt-0.5" />
                )}
              </ListRow>
            ))}
          </ListSection>
        ))}

        {!readOnly && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-2">
            <Button variant="plain" size="sm" onClick={onToggleDone}>
              {showDone ? 'Hide submitted' : 'Show submitted'}
            </Button>
            {showDone && <span className="text-footnote text-muted-foreground">{triage.doneCountStr}</span>}
          </div>
          {showDone && triage.doneTasks.length > 0 && (
            <ListSection>
              {triage.doneTasks.map((t) => (
                <ListRow key={t.id}>
                  <CheckCircle checked tone="green" label={`Reopen ${t.title}`} onClick={() => actions.setStatus(t.id, 'todo')} size="sm" />
                  <span className="text-footnote font-semibold text-tint-blue">{t.course}</span>
                  <span className="min-w-0 flex-1 truncate text-subhead text-muted-foreground">{t.title}</span>
                  <span className="text-footnote text-muted-foreground tabular">{t.weightStr}</span>
                  <Button variant="plain" size="sm" onClick={() => actions.setStatus(t.id, 'todo')}>
                    <Undo2 />
                    Undo
                  </Button>
                </ListRow>
              ))}
            </ListSection>
          )}
        </div>
        )}
      </div>

      {/* ── aside ───────────────────────────────────────────────────────── */}
      {!readOnly && (
      <aside className="flex min-w-0 flex-col gap-6">
        {blindSpots.length > 0 && (
          <Callout tone="orange" icon={TriangleAlert} title="Blind spot">
            {blindSpots.map((c) => c.code).join(', ')} has no weights entered, so nothing from it can be ranked.{' '}
            <button className="font-semibold text-tint-blue hover:underline" onClick={onGoConfig}>
              Enter weights
            </button>
          </Callout>
        )}

        <Card>
          <CardHeader>
            <CardDescription className="font-medium uppercase tracking-wide">At stake</CardDescription>
            <div className="flex items-end gap-2">
              <span className="font-display text-large-title font-bold text-tint-orange tabular">{deck.header.unbankedStr}</span>
              <span className="pb-1.5 text-footnote text-muted-foreground">of each course still unbanked, on average</span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stake.map((s) => (
              <div key={s.id}>
                <div className="flex justify-between text-footnote">
                  <span className="font-medium">{s.code}</span>
                  <span className="text-muted-foreground tabular">{s.label}</span>
                </div>
                <Progress value={s.pctNum} tone={s.tbd ? 'gray' : 'blue'} className="mt-1" />
              </div>
            ))}
          </CardContent>
        </Card>

        <ListSection header="Exam horizon">
          {horizonList.length === 0 && (
            <ListRow>
              <span className="text-footnote text-muted-foreground">No exam has a confirmed date inside the horizon.</span>
            </ListRow>
          )}
          {horizonList.map((hz, i) => (
            <ListRow key={i}>
              <div className="min-w-0 flex-1">
                <div className="text-footnote font-semibold text-tint-blue">{hz.course}</div>
                <div className="truncate text-subhead font-medium">{hz.name}</div>
                <div className="text-caption text-muted-foreground">{hz.dateStr}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-title-3 font-semibold tabular">{hz.daysStr}</div>
                <div className="text-caption text-muted-foreground tabular">{hz.weightStr}</div>
              </div>
            </ListRow>
          ))}
        </ListSection>

        <ListSection header="Open concepts" headerRight={deck.conceptCountStr} footer="No concept survives past the weekly review.">
          {conceptList.length === 0 && (
            <ListRow>
              <span className="text-footnote text-muted-foreground">Nothing open. Press S the moment you lose the thread.</span>
            </ListRow>
          )}
          {conceptList.map((c) => (
            <ListRow key={c.id} className="flex-col items-stretch gap-1.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-footnote font-semibold text-tint-blue">{c.course}</span>
                {c.stale ? <Badge tone="solid-orange">{c.ageStr} · escalate</Badge> : <Badge>{c.ageStr}</Badge>}
              </div>
              <p className="text-footnote text-pretty">{c.text}</p>
              <div className="flex gap-1">
                <Button variant="tinted" size="sm" onClick={() => onOpenLadder(c.id)}>Ladder</Button>
                <Button variant="plain" size="sm" onClick={() => actions.resolveConcept(c.id)}>Resolved</Button>
              </div>
            </ListRow>
          ))}
        </ListSection>

        <ListSection header="This week’s practice" headerRight={deck.weekBlockDateStr} footer="Closed-book textbook problems. Reading does not count.">
          {weekBlocks.map((b) => (
            <ListRow
              key={b.courseId}
              onClick={() => actions.toggleBlock(b.date, b.courseId)}
              role="checkbox"
              aria-checked={b.done}
              style={{ '--sep-inset': '3.25rem' }}
            >
              <CheckCircle checked={b.done} decorative />
              <span className="flex-1 text-subhead font-medium">{b.course} · 90 min</span>
              <span className="text-footnote text-muted-foreground">{b.errStr}</span>
            </ListRow>
          ))}
        </ListSection>

        <Card>
          <CardHeader>
            <CardTitle>HLTH 101 slip days</CardTitle>
            <CardDescription>No questions asked. Spend them on discussions, never on a term test.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <span className="font-display text-title-1 font-bold tabular">{slipDays} left</span>
            <div className="flex gap-2">
              <Button variant="gray" size="sm" onClick={() => actions.settings({ slipDays: Math.max(0, slipDays - 1) })}>
                Spend one
              </Button>
              <Button variant="plain" size="sm" onClick={() => actions.settings({ slipDays: Math.min(3, slipDays + 1) })}>
                Restore
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="px-4 text-caption text-muted-foreground">Exams enter this list at T-{rules.horizon}.</p>
      </aside>
      )}
    </div>
  );
}
