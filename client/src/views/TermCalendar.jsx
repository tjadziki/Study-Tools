import React, { useMemo, useState } from 'react';
import { TriangleAlert, FileText, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { d, fmtShort } from '../lib/dates.js';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Callout, Switch } from '@/components/ui/misc';

const dayName = (iso) => (iso ? d(iso).toLocaleDateString('en-CA', { weekday: 'short' }) : '');

export default function TermCalendar({ deck, actions }) {
  const confirmed = deck.settings.termCalendarConfirmed === 'true';
  const [weeks, setWeeks] = useState(() => deck.termWeeks.map((w) => ({ ...w, isReadingWeek: !!w.isReadingWeek })));
  const [dirty, setDirty] = useState(false);

  // Evidence the scanner found in the course files. Offered, never applied.
  const evidence = useMemo(() => {
    try {
      return deck.settings.readingWeekEvidence ? JSON.parse(deck.settings.readingWeekEvidence) : null;
    } catch {
      return null;
    }
  }, [deck.settings.readingWeekEvidence]);

  const current = weeks.find((w) => w.isReadingWeek);
  const evidenceDiffers =
    evidence && current && (current.startDate !== evidence.startDate || current.endDate !== evidence.endDate);

  const patch = (i, key, value) => {
    setWeeks((ws) => ws.map((w, j) => (j === i ? { ...w, [key]: value } : w)));
    setDirty(true);
  };

  /** Gaps and overlaps between consecutive weeks — the usual way this goes wrong. */
  const problems = useMemo(() => {
    const out = [];
    const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 0; i < sorted.length; i++) {
      const w = sorted[i];
      if (w.endDate < w.startDate) out.push(`${label(w)} ends before it starts.`);
      const next = sorted[i + 1];
      if (!next) continue;
      const expected = addDays(w.endDate, 1);
      if (next.startDate < expected) out.push(`${label(w)} overlaps ${label(next)}.`);
      else if (next.startDate > expected) out.push(`Gap between ${label(w)} and ${label(next)}.`);
    }
    return out;
  }, [weeks]);

  /**
   * Apply the scanner's reading-week evidence. Moving reading week alone would
   * leave the weeks either side overlapping it, so the immediate neighbours are
   * trimmed to butt up against the new span; the rest of the numbering stays.
   */
  const applyEvidence = () => {
    if (!evidence) return;
    setWeeks((ws) => {
      const sorted = [...ws].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const i = sorted.findIndex((w) => w.isReadingWeek);
      if (i === -1) return ws;
      return sorted.map((w, j) => {
        if (j === i) return { ...w, startDate: evidence.startDate, endDate: evidence.endDate };
        if (j === i - 1) return { ...w, endDate: addDays(evidence.startDate, -1) };
        if (j === i + 1) return { ...w, startDate: addDays(evidence.endDate, 1) };
        return w;
      });
    });
    setDirty(true);
  };

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {confirmed ? (
        <Callout tone="green" icon={CircleCheck} title="Confirmed">
          Week-relative dates like “Friday of Week 5” are resolved against this calendar and trusted.
        </Callout>
      ) : (
        <Callout tone="orange" icon={TriangleAlert} title="Not confirmed yet">
          This calendar is a best guess. Until you confirm it, any date written as “Friday of Week 5” stays at low
          confidence and is not trusted.
        </Callout>
      )}

      {evidence && (
        <Card>
          <CardHeader>
            <CardTitle>Found in your course files</CardTitle>
            <CardDescription>
              A scanned document says reading week runs{' '}
              <b className="text-foreground">
                {fmtShort(evidence.startDate)} – {fmtShort(evidence.endDate)}
              </b>
              {evidenceDiffers
                ? `, which differs from the ${current ? `${fmtShort(current.startDate)} – ${fmtShort(current.endDate)}` : 'current'} guess below.`
                : ' — matching what is set below.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-caption text-muted-foreground">
              <FileText className="size-3" />
              {String(evidence.sourceFile).split(/[\\/]/).pop()}
            </span>
            {evidenceDiffers && (
              <Button variant="tinted" size="sm" onClick={applyEvidence}>
                Use the scanned dates
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {problems.length > 0 && (
        <Callout tone="red" icon={TriangleAlert} title="Check these">
          {problems.slice(0, 6).join(' ')}
        </Callout>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="text-caption uppercase tracking-wide text-muted-foreground">
                <th className="py-3 pl-5 pr-3 font-medium">Week</th>
                <th className="px-3 py-3 font-medium">Starts</th>
                <th className="px-3 py-3 font-medium">Ends</th>
                <th className="px-3 py-3 font-medium">Reading week</th>
                <th className="py-3 pl-3 pr-5 font-medium">Span</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={`${w.weekNumber}-${i}`} className={cn('border-t border-border', w.isReadingWeek && 'bg-ios-orange/10')}>
                  <td className={cn('py-2 pl-5 pr-3 text-subhead font-semibold tabular', w.isReadingWeek ? 'text-tint-orange' : '')}>
                    {label(w)}
                  </td>
                  <td className="px-3 py-2">
                    <Input type="date" className="h-8 w-40" value={w.startDate} onChange={(e) => patch(i, 'startDate', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="date" className="h-8 w-40" value={w.endDate} onChange={(e) => patch(i, 'endDate', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      on={w.isReadingWeek}
                      label={`${label(w)} is reading week`}
                      onChange={() => patch(i, 'isReadingWeek', !w.isReadingWeek)}
                    />
                  </td>
                  <td className="py-2 pl-3 pr-5 text-footnote text-muted-foreground">
                    {dayName(w.startDate)} → {dayName(w.endDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={async () => {
            await actions.saveTermWeeks(weeks, true);
            setDirty(false);
          }}
        >
          {confirmed && !dirty ? 'Re-confirm calendar' : 'Save & confirm'}
        </Button>
        <Button
          variant="gray"
          onClick={async () => {
            await actions.saveTermWeeks(weeks, false);
            setDirty(false);
          }}
        >
          Save without confirming
        </Button>
        {dirty && <span className="text-footnote font-medium text-tint-orange">Unsaved changes</span>}
      </div>

      <p className="max-w-2xl text-footnote text-muted-foreground text-pretty">
        Reading week is stored outside the lecture numbering, so “Week 6” means the week after it. Rescan after
        confirming to re-resolve any week-relative dates at their new confidence.
      </p>
    </div>
  );
}

function label(w) {
  return w.isReadingWeek ? 'Reading' : `Week ${w.weekNumber}`;
}

function addDays(iso, n) {
  const dt = new Date(`${iso}T12:00:00`);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
