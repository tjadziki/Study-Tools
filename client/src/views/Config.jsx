import React, { useMemo, useState } from 'react';
import { Plus, Trash2, FolderOpen, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import CommitInput from '../components/CommitInput.jsx';
import ScheduleEditor from '../components/ScheduleEditor.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input, NativeSelect, Field, inputClass } from '@/components/ui/input';
import { CheckCircle } from '@/components/ui/misc';
import { ListSection, ListRow } from '@/components/ui/list';

const CONF_TONE = { high: 'green', medium: 'blue', low: 'orange' };

export default function Config({ deck, actions, onAskReset }) {
  const { courses } = deck;
  const [add, setAdd] = useState({
    courseId: courses[0]?.id || '',
    kind: 'work',
    title: '',
    weight: '',
    estHours: '',
    dueDate: '',
  });

  // Rows arrive sorted by course, then date; group them without re-sorting.
  const groups = useMemo(() => {
    const out = [];
    for (const r of deck.configRows) {
      const last = out[out.length - 1];
      if (last && last.course === r.course) last.rows.push(r);
      else out.push({ course: r.course, rows: [r] });
    }
    return out;
  }, [deck.configRows]);

  return (
    <div className="flex flex-col gap-10">
      {/* ── deliverables, one plate per course ──────────────────────────── */}
      <div className="flex flex-col gap-7">
        {groups.map((g) => {
          const total = g.rows.reduce((a, r) => a + (Number(r.weight) || 0), 0);
          return (
            <ListSection key={g.course} header={g.course} headerRight={`${Math.round(total * 10) / 10}% listed`}>
              <div className="hidden grid-cols-[minmax(0,1fr)_76px_76px_156px_132px_28px_32px] gap-3 px-4 pb-1 pt-2.5 text-caption uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Item</span>
                <span>Weight %</span>
                <span>Est. h</span>
                <span>Due</span>
                <span>Date status</span>
                <span className="text-center" title="Submitted">✓</span>
                <span />
              </div>
              {g.rows.map((cr) => (
                <ListRow
                  key={cr.id}
                  className="grid grid-cols-2 gap-3 py-2 lg:grid-cols-[minmax(0,1fr)_76px_76px_156px_132px_28px_32px]"
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-2 lg:col-span-1">
                    <span className={cn('truncate text-subhead', cr.status === 'done' && 'text-muted-foreground line-through')}>
                      {cr.title}
                    </span>
                    {cr.isExam && <Badge tone="orange">Exam</Badge>}
                  </div>
                  <CommitInput
                    className={cn(inputClass, 'h-8')}
                    aria-label={`${cr.title} weight`}
                    inputMode="decimal"
                    value={String(cr.weight)}
                    onCommit={(v) => {
                      const n = Number(v);
                      if (!Number.isNaN(n) && n !== cr.weight) actions.patchTask(cr.id, { weight: n });
                    }}
                  />
                  <CommitInput
                    className={cn(inputClass, 'h-8')}
                    aria-label={`${cr.title} estimated hours`}
                    inputMode="decimal"
                    value={String(cr.estHours)}
                    onCommit={(v) => {
                      const n = Number(v);
                      if (!Number.isNaN(n) && n > 0 && n !== cr.estHours) actions.patchTask(cr.id, { estHours: n });
                    }}
                  />
                  <CommitInput
                    className={cn(inputClass, 'h-8 col-span-2 lg:col-span-1')}
                    aria-label={`${cr.title} due date`}
                    type="date"
                    value={cr.dueDate || ''}
                    // Long enough that stepping through months in the picker
                    // never lands a half-finished date on the server.
                    quietMs={1200}
                    onCommit={(v) => actions.patchTask(cr.id, { dueDate: v || null })}
                  />
                  <span className="flex items-center" title={cr.sourceFile || 'entered by hand'}>
                    {cr.dueDate ? (
                      cr.userConfirmed ? (
                        <Badge tone="green">Confirmed</Badge>
                      ) : (
                        <Badge tone={CONF_TONE[cr.confidence]}>{cr.confidence} · unconfirmed</Badge>
                      )
                    ) : (
                      <Badge>No date</Badge>
                    )}
                  </span>
                  <span className="grid place-items-center">
                    <CheckCircle
                      checked={cr.status === 'done'}
                      tone="green"
                      size="sm"
                      label={cr.status === 'done' ? `Reopen ${cr.title}` : `Mark ${cr.title} submitted`}
                      onClick={() => actions.setStatus(cr.id, cr.status === 'done' ? 'todo' : 'done')}
                    />
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${cr.title}`}
                    className="justify-self-end text-muted-foreground hover:text-tint-red"
                    onClick={() => actions.deleteTask(cr.id)}
                  >
                    <Trash2 />
                  </Button>
                </ListRow>
              ))}
            </ListSection>
          );
        })}
      </div>

      {/* ── add an item ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Add an item</CardTitle>
          <CardDescription>For anything posted on LEARN that is not in the deck yet. Anything typed here counts as confirmed.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field label="Course" className="w-32">
            <NativeSelect value={add.courseId} onChange={(e) => setAdd({ ...add, courseId: e.target.value })}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Title" className="min-w-[200px] flex-1">
            <Input value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} placeholder="Lab 2 / Assignment 1 / Quiz 3" />
          </Field>
          <Field label="Weight %" className="w-24">
            <Input inputMode="decimal" value={add.weight} onChange={(e) => setAdd({ ...add, weight: e.target.value })} />
          </Field>
          <Field label="Est. h" className="w-20">
            <Input inputMode="decimal" value={add.estHours} onChange={(e) => setAdd({ ...add, estHours: e.target.value })} />
          </Field>
          <Field label="Due" className="w-44">
            <Input type="date" value={add.dueDate} onChange={(e) => setAdd({ ...add, dueDate: e.target.value })} />
          </Field>
          <Field label="Kind" className="w-36">
            <NativeSelect value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value })}>
              <option value="work">Deliverable</option>
              <option value="exam">Exam</option>
            </NativeSelect>
          </Field>
          <Button
            disabled={!add.title.trim()}
            onClick={async () => {
              await actions.addTask({
                courseId: add.courseId,
                kind: add.kind,
                title: add.title.trim(),
                weight: Number(add.weight) || 0,
                estHours: Number(add.estHours) || 1,
                dueDate: add.dueDate || null,
              });
              setAdd({ ...add, title: '', weight: '', estHours: '', dueDate: '' });
            }}
          >
            <Plus />
            Add to deck
          </Button>
        </CardContent>
      </Card>

      {/* ── timetable + study window ────────────────────────────────────── */}
      <ScheduleEditor deck={deck} actions={actions} />

      {/* ── courses + danger zone ───────────────────────────────────────── */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ListSection header="Courses & who to escalate to">
          {courses.map((c) => (
            <ListRow key={c.id} className="flex-col items-start gap-0.5 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-subhead font-semibold text-tint-blue">{c.code}</span>
                <span className="text-subhead font-semibold">{c.title}</span>
                <span className="text-footnote text-muted-foreground">{c.instructor}</span>
              </div>
              <div className="text-footnote text-muted-foreground">{c.meets}</div>
              <div className="text-footnote">Escalate to: {c.contact}</div>
              <div className="flex items-center gap-1 text-caption text-muted-foreground">
                <FolderOpen className="size-3" />
                {c.folderPath || 'No folder matched yet — create one and rescan'}
              </div>
            </ListRow>
          ))}
        </ListSection>

        <Card className="ring-1 ring-ios-red/30">
          <CardHeader>
            <CardTitle className="text-tint-red">Reset the deck</CardTitle>
            <CardDescription>
              Wipes tasks, error log, concepts, sessions and settings, then reloads the seeded term. Your course files are
              never touched, and the scanner’s file ledger is kept.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={onAskReset}>
              <RotateCcw />
              Reset deck…
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
