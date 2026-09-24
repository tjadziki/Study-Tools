import React from 'react';
import { PenLine, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CheckCircle, Stat, Kbd } from '@/components/ui/misc';
import { ListSection, ListRow } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';

export default function Retrieval({ deck, actions, bankCourseId, onOpenError }) {
  const { fridayRows, bankRows, examCourses } = deck;
  const bank = bankCourseId ? deck.bankFor(bankCourseId) : { topicGroups: [], counterStr: '' };

  return (
    <div className="grid items-start gap-8 xl:grid-cols-2">
      {/* ── practice grid ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4"><Stat label="Streak" value={deck.header.practiceStreakStr} /></Card>
          <Card className="p-4"><Stat label="Blocks logged" value={deck.blocksLoggedStr} /></Card>
          <Card className="p-4"><Stat label="Errors banked" value={deck.header.errorTotalStr} tone="blue" /></Card>
        </div>

        <ListSection header="Friday practice blocks" footer="90 minutes per exam course, closed book. Reading does not count.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left">
              <thead>
                <tr className="text-caption uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-3 font-medium">Friday</th>
                  {examCourses.map((c) => (
                    <th key={c.id} className="px-2 py-2.5 text-center font-medium">{c.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fridayRows.map((f) => (
                  <tr key={f.date} className="border-t border-border">
                    <td className="py-2 pl-4 pr-3 text-footnote text-muted-foreground tabular">{f.label}</td>
                    {f.cells.map((cell) => (
                      <td key={cell.courseId} className="px-2 py-1.5">
                        <div className="grid place-items-center">
                          <CheckCircle
                            checked={cell.done}
                            size="sm"
                            label={`${deck.code(cell.courseId)} practice, ${f.label}`}
                            onClick={() => actions.toggleBlock(cell.date, cell.courseId)}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListSection>
      </div>

      {/* ── error log ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {bankRows.length > 1 && (
            <Segmented
              ariaLabel="Course"
              value={bankCourseId}
              onChange={(id) => actions.setBankCourseId(id)}
              options={bankRows.map((b) => ({ value: b.id, label: b.course }))}
            />
          )}
          <Button onClick={onOpenError}>
            <PenLine />
            Log an error
            <Kbd className="border-white/30 bg-white/15 text-white shadow-none">E</Kbd>
          </Button>
        </div>

        <ListSection header="Error bank" footer="The reason, not the question number.">
          {bankRows.map((bk) => (
            <ListRow key={bk.id} onClick={() => actions.setBankCourseId(bk.id)} className={cn(bankCourseId === bk.id && 'bg-primary/5')}>
              <div className="min-w-0 flex-1">
                <div className={cn('text-subhead font-semibold', bankCourseId === bk.id ? 'text-tint-blue' : '')}>{bk.course}</div>
                <div className="text-footnote text-muted-foreground">{bk.summary}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-title-3 font-semibold tabular">{bk.countStr}</div>
                <div className="text-caption text-muted-foreground">{bk.readyStr}</div>
              </div>
            </ListRow>
          ))}
        </ListSection>

        {bankCourseId && (
          <Card>
            <CardHeader>
              <CardDescription className="font-medium uppercase tracking-wide">Read this the night before</CardDescription>
              <CardTitle className="text-title-2">{deck.code(bankCourseId)} error log</CardTitle>
              <CardDescription>{bank.counterStr}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {bank.topicGroups.map((g) => (
                <div key={g.topic}>
                  <div className="flex items-baseline gap-2">
                    <span className="rounded-full bg-ios-orange/15 px-2 text-caption font-semibold text-tint-orange tabular">×{g.countStr}</span>
                    <span className="text-headline font-semibold">{g.topic}</span>
                  </div>
                  <div className="mt-2 flex flex-col">
                    {g.entries.map((en) => (
                      <div key={en.id} className="group flex items-start gap-3 border-t border-border py-2 first:border-t-0">
                        <span className="w-12 shrink-0 pt-0.5 text-caption text-muted-foreground tabular">{en.dateStr}</span>
                        <span className="min-w-0 flex-1 text-subhead text-pretty">{en.what}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete entry"
                          className="text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                          onClick={() => actions.deleteError(en.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {bank.topicGroups.length === 0 && (
                <p className="text-subhead text-muted-foreground text-pretty">
                  Nothing banked for {deck.code(bankCourseId)} yet. This is what you read the night before the exam — if
                  it is empty then, the exam is a first encounter.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
