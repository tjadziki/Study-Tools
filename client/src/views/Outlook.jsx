import React, { useState } from 'react';
import { CircleCheck, TriangleAlert, CircleAlert, Flame, Check, CalendarX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress, Callout } from '@/components/ui/misc';
import { ListSection, ListRow } from '@/components/ui/list';
import { d, fmtShort } from '../lib/dates.js';

// Exam verdicts. Colour is never the only signal: each carries an icon and a word.
const VERDICT = {
  'on-track': { label: 'On track', tone: 'green', bar: 'green', icon: CircleCheck },
  tight: { label: 'Tight', tone: 'orange', bar: 'orange', icon: TriangleAlert },
  short: { label: 'Short', tone: 'red', bar: 'red', icon: CircleAlert },
  done: { label: 'Done', tone: 'green', bar: 'green', icon: Check },
};

// Week levels, same rule.
const LEVEL = {
  heavy: { label: 'Heavy', bar: 'bg-chart-heavy', badge: 'red', icon: Flame },
  busy: { label: 'Busy', bar: 'bg-chart-busy', badge: 'orange', icon: TriangleAlert },
  normal: { label: '', bar: 'bg-chart-calm', badge: null, icon: null },
};

export default function Outlook({ deck, onGoConfig }) {
  return (
    <div className="flex flex-col gap-9">
      <AttentionCallouts deck={deck} onGoConfig={onGoConfig} />
      <ExamReadiness deck={deck} />
      <WeekChart outlook={deck.outlook} />
      <FlaggedWeeks outlook={deck.outlook} />
    </div>
  );
}

/** The few things on this screen that need action. Nothing when all is well. */
export function AttentionCallouts({ deck, onGoConfig }) {
  const { forecast, outlook } = deck;
  const attention = forecast.rows.filter((r) => r.status === 'tight' || r.status === 'short');
  const clash = forecast.rows.find((r) => r.clashes.some((c) => c.sameDay));
  if (!outlook.afterTerm.length && !attention.length && !clash) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
          {outlook.afterTerm.map((t) => (
            <Callout key={t.id} tone="red" icon={CalendarX} title={`${t.course} ${t.title} is dated ${t.dueStr}`}>
              That is after the exam period ends, which almost always means a slip in the date picker. A wrong
              deadline is worse than none —{' '}
              {onGoConfig ? (
                <button className="font-semibold text-tint-blue hover:underline" onClick={onGoConfig}>
                  check it in Config
                </button>
              ) : (
                'fix it in Config on the laptop'
              )}
              .
            </Callout>
          ))}
          {clash && (
            <Callout tone="orange" icon={TriangleAlert} title={`Two exams on ${clash.dateStr}`}>
              {clash.course} {clash.title} and {clash.clashes.filter((c) => c.sameDay).map((c) => `${c.course} ${c.title}`).join(', ')}{' '}
              land on the same day. The forecast below already has them competing for the same blocks.
            </Callout>
          )}
          {attention.map((r) => {
            const v = VERDICT[r.status];
            return (
              <Callout key={r.id} tone={r.status === 'short' ? 'red' : 'orange'} icon={v.icon} title={`${r.course} ${r.title}: ${v.label.toLowerCase()}`}>
                {r.verdict}
              </Callout>
            );
          })}
        </div>
  );
}

/* ── 7. exam readiness ───────────────────────────────────────────────────── */
export function ExamReadiness({ deck }) {
  const { forecast } = deck;
  return (
      <ListSection
        header="Exam readiness"
        footer="Walks your plan forward day by day and counts the prep each exam actually gets before its date — dedicated prep plus that course's retrieval practice — against its estimate, minus hours already worked."
      >
        {forecast.rows.map((r) => {
          const v = VERDICT[r.status];
          const dt = d(r.dueDate);
          return (
            <ListRow key={r.id} className="items-start gap-4 py-3.5" style={{ '--sep-inset': '5rem' }}>
              <div className="w-12 shrink-0 text-center">
                <div className="text-caption font-semibold uppercase text-tint-red">
                  {dt.toLocaleDateString('en-CA', { month: 'short' })}
                </div>
                <div className="font-display text-title-2 font-semibold leading-7">{dt.getDate()}</div>
                <div className="text-caption-2 text-muted-foreground tabular">T-{r.daysLeft}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-footnote font-semibold text-tint-blue">{r.course}</span>
                  <span className="text-subhead font-semibold">{r.title}</span>
                  <span className="text-footnote text-muted-foreground">{r.weight}%</span>
                  {r.clashes.map((c, i) => (
                    <Badge key={i} tone="orange">
                      {c.sameDay ? 'Same day as' : 'Near'} {c.course}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 text-footnote text-foreground/80 text-pretty">{r.verdict}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Progress value={r.coveragePct} tone={v.bar} className="max-w-xs" />
                  <span className="shrink-0 text-caption text-muted-foreground tabular">
                    {r.plannedH} of {r.leftH} h
                  </span>
                </div>
                <div className="mt-1 text-caption text-muted-foreground">
                  {r.firstPrepStr ? `Prep starts ${r.firstPrepStr}` : 'No prep scheduled yet'}
                  {/* Only courses the error log tracks have a floor to meet. */}
                  {deck.byId[r.courseId]?.examCourse && (
                    <>
                      {' · '}
                      <span className={r.errorsShort ? 'text-tint-orange' : ''}>
                        {r.errors}/{r.errorFloor} errors banked
                      </span>
                    </>
                  )}
                  {r.doneH > 0 && ` · ${r.doneH} h already worked`}
                </div>
              </div>
              <Badge tone={v.tone} className="mt-0.5">
                <v.icon />
                {v.label}
              </Badge>
            </ListRow>
          );
        })}
        {forecast.undated.map((u) => (
          <ListRow key={u.id} className="gap-4" style={{ '--sep-inset': '5rem' }}>
            <div className="w-12 shrink-0 text-center text-title-3 text-label-3">—</div>
            <div className="min-w-0 flex-1">
              <span className="text-footnote font-semibold text-tint-blue">{u.course}</span>{' '}
              <span className="text-subhead font-medium text-muted-foreground">{u.title}</span>
            </div>
            <Badge>No date</Badge>
          </ListRow>
        ))}
        {forecast.rows.length === 0 && forecast.undated.length === 0 && (
          <ListRow>
            <span className="text-footnote text-muted-foreground">No exams in the deck.</span>
          </ListRow>
        )}
      </ListSection>
  );
}

/** Each heavy or busy week, item by item, with when to start. */
export function FlaggedWeeks({ outlook }) {
  return (
    <>
      {outlook.flagged.map((w) => {
        const L = LEVEL[w.level];
        return (
          <ListSection
            key={w.mon}
            header={`${w.label} · ${w.rangeStr}`}
            headerRight={
              <Badge tone={L.badge}>
                <L.icon />
                {L.label}
              </Badge>
            }
            footer={w.headline}
          >
            {w.items.map((it) => (
              <ListRow key={it.id}>
                <div className="min-w-0 flex-1">
                  <span className="text-footnote font-semibold text-tint-blue">{it.course}</span>{' '}
                  <span className="text-subhead font-medium">{it.title}</span>
                  {it.kind === 'exam' && <Badge tone="orange" className="ml-2">Exam</Badge>}
                </div>
                <span className="w-16 text-right text-footnote text-muted-foreground tabular">{it.dueStr}</span>
                <span className="w-14 text-right text-footnote font-medium tabular">{it.leftH} h</span>
                <span className={cn('w-24 text-right text-footnote tabular', it.startByStr === 'now' ? 'font-semibold text-tint-orange' : 'text-muted-foreground')}>
                  start {it.startByStr === 'now' ? 'now' : `by ${it.startByStr}`}
                </span>
              </ListRow>
            ))}
            {w.tentative.length > 0 && (
              <ListRow>
                <span className="text-footnote text-muted-foreground">
                  Also {w.tentative.length} unconfirmed date{w.tentative.length > 1 ? 's' : ''} this week, not counted:{' '}
                  {w.tentative.map((t) => `${t.course} ${t.title} (${t.dateStr})`).join(', ')}.
                </span>
              </ListRow>
            )}
          </ListSection>
        );
      })}
    </>
  );
}

/* ── the busy-weeks chart ────────────────────────────────────────────────────
   One series — hours of work due each week — so no legend; the title names
   it. Horizontal bars (week labels are long and there are ~15 of them), thin,
   square at the baseline and rounded at the data end, value at the tip. A
   solid hairline marks the hours you plan to study in a week. Each bar's
   colour is its level, always doubled by the level in words. Hover or focus a
   week for what is in it; the whole thing is also available as a table.
   ────────────────────────────────────────────────────────────────────────── */
export function WeekChart({ outlook }) {
  const [hover, setHover] = useState(null);
  const weeks = outlook.weeks;
  if (!weeks.length) return null;

  const maxLoad = Math.max(outlook.capacityH, ...weeks.map((w) => w.loadH));
  const step = maxLoad > 60 ? 20 : 10;
  const scale = Math.ceil((maxLoad * 1.04) / step) * step;
  const ticks = Array.from({ length: scale / step + 1 }, (_, i) => i * step);
  const pct = (h) => (h / scale) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours of work due each week</CardTitle>
        <CardDescription>
          Against the {outlook.capacityH} h you plan to study in a week. A long bar means that work has to start in an
          earlier week.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* rows */}
          <div className="flex flex-col">
            {weeks.map((w) => {
              const L = LEVEL[w.level];
              const p = pct(w.loadH);
              const inside = p > 84;
              const open = hover === w.mon;
              return (
                <div
                  key={w.mon}
                  tabIndex={0}
                  onMouseEnter={() => setHover(w.mon)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(w.mon)}
                  onBlur={() => setHover(null)}
                  aria-label={`${w.rangeStr}: ${w.loadH} hours due${L.label ? `, ${L.label.toLowerCase()}` : ''}`}
                  className="group relative grid grid-cols-[64px_minmax(0,1fr)_28px] items-center gap-3 rounded-lg py-[5px] outline-none focus-visible:bg-secondary/60 sm:grid-cols-[124px_minmax(0,1fr)_76px]"
                >
                  <span className={cn('text-footnote tabular', w.isThisWeek ? 'font-semibold text-tint-blue' : 'text-muted-foreground')}>
                    {/* A phone gets the Monday; wider screens the whole range. */}
                    <span className="sm:hidden">{w.isThisWeek ? 'Now' : fmtShort(w.mon)}</span>
                    <span className="hidden sm:inline">{w.isThisWeek ? 'This week' : w.rangeStr}</span>
                  </span>
                  <div className="relative h-[18px]">
                    {w.loadH > 0 && (
                      <div
                        className={cn('absolute inset-y-0 left-0 rounded-r-[4px] transition-opacity', L.bar, hover && !open && 'opacity-45')}
                        style={{ width: `${Math.max(0.6, p)}%` }}
                      />
                    )}
                    <span
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-caption font-semibold tabular',
                        inside ? 'pr-1.5 text-white' : 'pl-1.5 text-foreground'
                      )}
                      style={inside ? { right: `${100 - p}%` } : { left: `${p}%` }}
                    >
                      {w.loadH ? `${w.loadH} h` : ''}
                    </span>
                  </div>
                  <span className="justify-self-start">
                    {L.badge && (
                      <Badge tone={L.badge} aria-label={L.label} className="px-1.5 sm:px-2">
                        <L.icon />
                        <span className="hidden sm:inline">{L.label}</span>
                      </Badge>
                    )}
                  </span>

                  {open && w.items.length > 0 && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-[min(360px,calc(100vw-4rem))] rounded-xl bg-popover p-3 text-popover-foreground shadow-xl shadow-black/15 ring-1 ring-border sm:left-[136px]">
                      <div className="text-footnote font-semibold">
                        {w.rangeStr} · {w.loadH} h due
                      </div>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {w.items.map((it) => (
                          <div key={it.id} className="flex gap-2 text-caption">
                            <span className="w-11 shrink-0 text-muted-foreground tabular">{it.dueStr}</span>
                            <span className="min-w-0 flex-1">
                              <span className="font-semibold text-tint-blue">{it.course}</span> {it.title}
                            </span>
                            <span className="shrink-0 tabular">{it.leftH} h</span>
                          </div>
                        ))}
                      </div>
                      {w.headline && <div className="mt-2 text-caption text-muted-foreground">{w.headline}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* The capacity reference: a solid hairline through every row. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 grid grid-cols-[64px_minmax(0,1fr)_28px] gap-3 sm:grid-cols-[124px_minmax(0,1fr)_76px]"
            style={{ left: 0, right: 0 }}
          >
            <span />
            <div className="relative">
              <div className="absolute inset-y-0 w-px bg-foreground/35" style={{ left: `${pct(outlook.capacityH)}%` }} />
            </div>
          </div>

          {/* axis */}
          <div className="mt-1 grid grid-cols-[64px_minmax(0,1fr)_28px] gap-3 sm:grid-cols-[124px_minmax(0,1fr)_76px]">
            <span />
            <div className="relative h-4 border-t border-border">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-1 -translate-x-1/2 text-caption-2 text-muted-foreground tabular"
                  style={{ left: `${pct(t)}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
            <span className="text-caption-2 text-muted-foreground">hours</span>
          </div>
          <div className="mt-1 grid grid-cols-[64px_minmax(0,1fr)_28px] gap-3 sm:grid-cols-[124px_minmax(0,1fr)_76px]">
            <span />
            <div className="relative h-4">
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap text-caption-2 text-muted-foreground"
                style={{ left: `${pct(outlook.capacityH)}%` }}
              >
                {outlook.capacityH} h you study in a week
              </span>
            </div>
          </div>
        </div>

        <details className="mt-4 text-footnote">
          <summary className="cursor-pointer select-none font-medium text-tint-blue">Show every week as a table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-footnote">
              <thead className="text-caption uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Week</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Hours due</th>
                  <th className="py-1.5 pr-3 font-medium">Level</th>
                  <th className="py-1.5 pr-3 font-medium">Start by</th>
                  <th className="py-1.5 font-medium">Due that week</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.mon} className="border-t border-border align-top">
                    <td className="py-1.5 pr-3 tabular">{w.rangeStr}</td>
                    <td className="py-1.5 pr-3 text-right tabular">{w.loadH}</td>
                    <td className="py-1.5 pr-3">{LEVEL[w.level].label || 'Normal'}</td>
                    <td className="py-1.5 pr-3 tabular">{w.level === 'normal' ? '—' : w.startByStr}</td>
                    <td className="py-1.5 text-muted-foreground">
                      {w.items.map((it) => `${it.course} ${it.title}`).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
