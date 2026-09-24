import React from 'react';
import { TriangleAlert, CalendarX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Stat, Callout } from '@/components/ui/misc';

export default function Exams({ deck }) {
  const { examRows, undatedExams, rules } = deck;

  return (
    <div className="flex flex-col gap-6">
      {undatedExams.length > 0 && (
        <Callout tone="orange" icon={CalendarX} title="Not yet back-plannable">
          {undatedExams.length} exam{undatedExams.length === 1 ? ' has' : 's have'} no confirmed date, so no taper can be
          drawn: {undatedExams.map((x) => `${x.course} ${x.name} (${x.weightStr})`).join(' · ')}.
        </Callout>
      )}

      {examRows.map((x) => (
        <Card key={x.id} className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[1_1_240px]">
              <div className="text-footnote font-semibold text-tint-blue">{x.course}</div>
              <h2 className="font-display text-title-2 font-bold">{x.name}</h2>
              <div className="mt-0.5 text-footnote text-muted-foreground">{x.dateStr}</div>
            </div>
            <div className="flex gap-8">
              <Stat label="Weight" value={x.weightStr} />
              <Stat label="T-minus" value={x.daysStr} tone="orange" />
              <Stat label="Errors banked" value={x.bankStr} tone="blue" />
            </div>
          </div>

          {/* The taper as a stepped timeline: past steps fade, the rest stay lit. */}
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {x.steps.map((st) => (
              <li
                key={st.label}
                className={cn('rounded-xl p-3', st.past ? 'bg-secondary/50 opacity-60' : 'bg-secondary')}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('text-footnote font-semibold', st.past ? 'text-muted-foreground' : 'text-tint-blue')}>
                    {st.label === 'NIGHT BEFORE' ? 'Night before' : st.label}
                  </span>
                  <span className="text-caption text-muted-foreground tabular">{st.dateStr}</span>
                </div>
                <p className="mt-1 text-footnote text-foreground/80 text-pretty">{st.what}</p>
              </li>
            ))}
          </ol>

          {x.warn && (
            <Callout tone="red" icon={TriangleAlert} title="Cramming risk">
              Not enough retrieval practice banked — {x.bankStr} entries against a floor of {rules.minErr} at T-14.
            </Callout>
          )}
          {x.projection && <p className="text-footnote text-muted-foreground text-pretty">{x.projectionStr}</p>}
        </Card>
      ))}

      {examRows.length === 0 && (
        <p className="text-subhead text-muted-foreground">No exam has a confirmed date yet.</p>
      )}
    </div>
  );
}
