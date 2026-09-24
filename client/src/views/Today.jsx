import React from 'react';
import { FileText, LifeBuoy, PenLine, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress, CheckCircle, Callout } from '@/components/ui/misc';
import { ListSection, ListRow } from '@/components/ui/list';

// What each kind of block is for, said once, in the same colour everywhere.
export const BLOCK = {
  deliverable: { label: 'Deliverable', tone: 'blue' },
  exam: { label: 'Exam prep', tone: 'orange' },
  consolidate: { label: 'Consolidate', tone: 'green' },
  retrieval: { label: 'Retrieval', tone: 'indigo' },
  read: { label: 'Read ahead', tone: 'teal' },
  unblock: { label: 'Unblock', tone: 'red' },
  spare: { label: 'Spare', tone: 'gray' },
};

const RULE = {
  blue: 'bg-primary',
  orange: 'bg-ios-orange',
  green: 'bg-ios-green',
  indigo: 'bg-ios-indigo',
  teal: 'bg-ios-teal',
  red: 'bg-ios-red',
  gray: 'bg-label-3',
};

const hoursStr = (min) => `${(min / 60).toFixed(min % 60 ? 1 : 0)} h`;

export default function Today({ deck, actions, now, onGoQueue, onGoConfig, readOnly = false }) {
  const day = deck.today;
  const week = deck.weekPlan;
  if (!day) return null;

  const t = new Date(now);
  const nowMin = t.getHours() * 60 + t.getMinutes();
  const live = day.slots.find((s) => nowMin >= s.startMin && nowMin < s.endMin);
  const next = day.slots.find((s) => s.startMin > nowMin && !s.done);
  // Once every block today is behind you, the useful answer to "what now?"
  // is tomorrow's first block — not a 07:30 slot that has already gone.
  const tomorrow = week[1];
  const upcoming = live || next;
  const focusDay = upcoming ? day : tomorrow;
  const focus = upcoming || tomorrow?.slots.find((s) => !s.spare) || tomorrow?.slots[0] || null;
  const inClass = day.classes.find((c) => nowMin >= c.startMin && nowMin < c.endMin);
  const focusLabel = inClass && upcoming
    ? 'After this class'
    : live
      ? 'Right now'
      : upcoming
        ? 'Up next'
        : `Tomorrow · ${tomorrow?.dayName}`;

  // Classes and study blocks on one spine, in the order they happen.
  const timeline = [
    ...day.classes.map((c) => ({ ...c, row: 'class' })),
    ...day.slots.map((s) => ({ ...s, row: 'slot' })),
  ].sort((a, b) => a.startMin - b.startMin);

  const donePct = day.targetMin ? (day.doneMin / day.targetMin) * 100 : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* ── progress toward today's target ──────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="text-subhead text-muted-foreground">
            {t.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })} ·{' '}
            {day.classes.length ? `${day.classes.length} class${day.classes.length > 1 ? 'es' : ''}` : 'no classes'} ·{' '}
            {hoursStr(day.capacityMin)} free
          </div>
          <Progress value={donePct} tone={day.metTarget ? 'green' : 'blue'} className="mt-3 h-2 max-w-xl" />
        </div>
        <div className="text-right">
          <div className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Worked today</div>
          <div className="font-display text-title-1 font-semibold tabular">
            <span className={day.metTarget ? 'text-tint-green' : ''}>{hoursStr(day.doneMin)}</span>
            <span className="text-muted-foreground"> / {hoursStr(day.targetMin)}</span>
          </div>
        </div>
      </div>

      {day.shortOfCapacity && (
        <Callout tone="orange" title="Not enough room today">
          Classes leave only {hoursStr(day.capacityMin)} inside your study window, so the {hoursStr(day.targetMin)}{' '}
          target cannot be met without borrowing from another day.
        </Callout>
      )}

      {/* ── now ─────────────────────────────────────────────────────────── */}
      {focus && (
        <Card className={cn('overflow-hidden', live && 'ring-2 ring-ios-orange/60')}>
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={live ? 'solid-orange' : 'solid-blue'}>{focusLabel}</Badge>
              <span className="text-subhead font-medium text-muted-foreground tabular">{focus.timeStr}</span>
              {focus.course && <span className="text-subhead font-semibold text-tint-blue">{focus.course}</span>}
              <Badge tone={BLOCK[focus.tag]?.tone}>{BLOCK[focus.tag]?.label || focus.tag}</Badge>
            </div>
            <div>
              <h2 className="font-display text-title-1 font-bold text-balance">{focus.title}</h2>
              <p className="mt-2 max-w-2xl text-body text-foreground/85 text-pretty">{focus.action}</p>
              <p className="mt-1.5 text-footnote text-muted-foreground">{focus.why}</p>
            </div>
            {focus.material && (
              <div className="flex items-center gap-2 self-start rounded-xl bg-secondary px-3 py-2 text-footnote">
                <FileText className="size-4 text-tint-blue" />
                <span className="text-muted-foreground">Open</span>
                <span className="font-medium">{focus.material.name}</span>
              </div>
            )}
            {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button variant={focus.done ? 'gray' : 'default'} onClick={() => actions.toggleSlot(focusDay.date, focus)}>
                <Check />
                {focus.done ? 'Worked — undo' : `Mark this ${focus.minutes}-minute block worked`}
              </Button>
              {focus.courseId && (
                <Button variant="tinted" onClick={() => actions.openErrorFor(focus.courseId)}>
                  <PenLine />
                  Log an error
                </Button>
              )}
              {focus.courseId && (
                <Button variant="plain" onClick={() => actions.openStuckFor(focus.courseId)}>
                  <LifeBuoy />
                  I’m stuck
                </Button>
              )}
            </div>
            )}
          </div>
        </Card>
      )}

      {/* ── the day ─────────────────────────────────────────────────────── */}
      <ListSection header="Today" headerRight={`${hoursStr(day.committedMin)} committed`}>
        {timeline.map((row) =>
          row.row === 'class' ? (
            <ListRow key={`c-${row.id}`} className="bg-secondary/40">
              <span className="w-[104px] shrink-0 text-footnote text-muted-foreground tabular">{row.timeStr}</span>
              <span className="text-subhead font-semibold text-muted-foreground">{row.course}</span>
              <Badge tone="gray">{row.kind}</Badge>
              <span className="text-footnote text-muted-foreground">in class</span>
            </ListRow>
          ) : (
            <ListRow key={`s-${row.key}`} className={cn('items-start py-3', ((row.spare && !row.done) || row.missed) && 'opacity-55')}>
              <span className={cn('mt-0.5 w-1 self-stretch rounded-full', row.done ? 'bg-ios-green' : RULE[BLOCK[row.tag]?.tone || 'gray'])} />
              <span className="w-[92px] shrink-0 pt-0.5 text-footnote text-muted-foreground tabular">{row.timeStr}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {row.course && <span className="text-footnote font-semibold text-tint-blue">{row.course}</span>}
                  <span className={cn('text-subhead font-semibold', row.done && 'text-muted-foreground line-through')}>
                    {row.title}
                  </span>
                  <Badge tone={BLOCK[row.tag]?.tone}>{BLOCK[row.tag]?.label || row.tag}</Badge>
                  {row.trap && <Badge tone="orange">Trap</Badge>}
                  {row.missed && <Badge tone="outline">Missed — moved forward</Badge>}
                  {row.spare && !row.missed && <Badge tone="outline">Beyond target</Badge>}
                </div>
                <p className="mt-1 text-footnote text-foreground/75 text-pretty">{row.action}</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {row.why}
                  {row.material ? ` · open ${row.material.name}` : ''}
                </p>
              </div>
              {readOnly ? (
                row.done && <CheckCircle checked tone="green" decorative className="mt-0.5" />
              ) : (
                <CheckCircle
                  checked={row.done}
                  tone="green"
                  label={row.done ? `Unmark ${row.title}` : `Mark ${row.title} worked`}
                  onClick={() => actions.toggleSlot(day.date, row)}
                  className="mt-0.5"
                />
              )}
            </ListRow>
          )
        )}
        {!timeline.length && (
          <ListRow>
            <span className="text-subhead text-muted-foreground">No study window today. Widen it in Config if that is wrong.</span>
          </ListRow>
        )}
      </ListSection>

      {/* ── the week ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3 px-4">
          <h3 className="text-footnote font-medium uppercase tracking-wide text-muted-foreground">The next seven days</h3>
          <span className="hidden text-footnote text-muted-foreground sm:block">each day’s work is retired from the next</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
          {week.map((wd) => (
            <Card key={wd.date} className={cn('flex flex-col gap-2 p-3.5', wd.isToday && 'ring-2 ring-primary')}>
              <div className="flex items-baseline justify-between">
                <span className={cn('text-footnote font-semibold uppercase', wd.isToday ? 'text-tint-blue' : 'text-muted-foreground')}>
                  {wd.dayName}
                </span>
                <span className="font-display text-title-3 font-semibold tabular">{wd.dayNum}</span>
              </div>
              {wd.due.length > 0 && (
                <div className="flex flex-col gap-1">
                  {wd.due.map((x, i) => (
                    <div key={i} className="rounded-md bg-ios-orange/15 px-1.5 py-0.5 text-caption font-medium leading-tight text-tint-orange">
                      {x.course} · {x.title}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-footnote leading-snug">
                {wd.focus ? (
                  <>
                    {wd.focus.course && <span className="font-semibold text-tint-blue">{wd.focus.course} </span>}
                    {wd.focus.title}
                  </>
                ) : (
                  <span className="text-muted-foreground">Nothing scheduled</span>
                )}
              </div>
              <div className="mt-auto text-caption text-muted-foreground tabular">
                {hoursStr(wd.capacityMin)} free · {hoursStr(wd.committedMin)} planned
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── why the plan looks like this ────────────────────────────────── */}
      {!readOnly && (
      <p className="max-w-3xl px-4 text-footnote text-muted-foreground text-pretty">
        Nothing here is stored. The blocks are your study window minus your timetable, filled from the same ranking the
        Triage list uses, so confirming a date changes tomorrow with no further step.
        {deck.unconfirmedDated > 0 && (
          <>
            {' '}
            <button className="font-medium text-tint-blue hover:underline" onClick={onGoQueue}>
              {deck.unconfirmedDated} scanned date{deck.unconfirmedDated > 1 ? 's are' : ' is'} still unconfirmed
            </button>{' '}
            and invisible to this plan.
          </>
        )}{' '}
        <button className="font-medium text-tint-blue hover:underline" onClick={onGoConfig}>
          Change your hours or timetable
        </button>
        .
      </p>
      )}
    </div>
  );
}
