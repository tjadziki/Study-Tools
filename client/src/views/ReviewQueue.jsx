import React, { useState } from 'react';
import { FileText, Check, X, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input, Field } from '@/components/ui/input';
import { Stat, Callout } from '@/components/ui/misc';

const CONF = {
  high: { label: 'High confidence', tone: 'green' },
  medium: { label: 'Medium confidence', tone: 'blue' },
  low: { label: 'Low confidence', tone: 'orange' },
};

function Confidence({ level }) {
  const c = CONF[level] || CONF.low;
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

/** The evidence: the sentence the date came from, why it was read that way, and the file. */
function Snippet({ text, file }) {
  const [snippet, reason] = String(text).split('\n— ');
  return (
    <div className="mt-3 rounded-xl bg-secondary p-3">
      <p className="whitespace-pre-wrap font-mono text-footnote leading-relaxed text-foreground/85">
        {snippet?.replace(/\t/g, '   ')}
      </p>
      {reason && <p className="mt-1.5 text-footnote text-muted-foreground text-pretty">{reason}</p>}
      {file && (
        <p className="mt-1.5 flex items-center gap-1 text-caption text-muted-foreground">
          <FileText className="size-3" />
          {file}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ children, tone }) {
  return (
    <h3 className={`px-1 text-footnote font-medium uppercase tracking-wide ${tone === 'orange' ? 'text-tint-orange' : 'text-muted-foreground'}`}>
      {children}
    </h3>
  );
}

export default function ReviewQueue({ deck, actions }) {
  const [edits, setEdits] = useState({});
  const rows = deck.reviewQueue;
  const setEdit = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const conflicts = rows.filter((r) => r.kind === 'conflict');
  const dates = rows.filter((r) => r.kind === 'date');
  const items = rows.filter((r) => r.kind === 'item');

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      {rows.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-ios-green/15 text-tint-green">
            <Inbox className="size-6" />
          </div>
          <div className="text-headline font-semibold">Nothing waiting</div>
          <p className="text-subhead text-muted-foreground">Run a rescan when a professor posts something new.</p>
        </Card>
      )}

      {/* ── conflicts first: they touch dates already confirmed ─────────── */}
      {conflicts.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeader tone="orange">Conflicts with confirmed dates · {conflicts.length}</SectionHeader>
          {conflicts.map((r) => (
            <Card key={r.id} className="p-5 ring-2 ring-ios-orange/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-footnote font-semibold text-tint-blue">{r.course}</span>
                <span className="text-headline font-semibold">{r.title}</span>
                <Confidence level={r.confidence} />
              </div>
              <div className="mt-3 flex flex-wrap gap-8">
                <Stat label="You confirmed" value={r.currentStr} size="sm" />
                <Stat label="Scan now says" value={r.proposedStr} size="sm" tone="orange" />
              </div>
              <Snippet text={r.sourceSnippet} file={r.sourceFile} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="gray" onClick={() => actions.resolveConflict(r.id, false)}>
                  Keep {r.currentStr}
                </Button>
                <Button onClick={() => actions.resolveConflict(r.id, true)}>Use {r.proposedStr}</Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {/* ── proposed dates for known deliverables ───────────────────────── */}
      {dates.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeader>Proposed dates · {dates.length}</SectionHeader>
          {dates.map((r) => {
            const value = edits[r.id]?.dueDate ?? r.proposedDate ?? '';
            const changed = value !== r.proposedDate;
            return (
              <Card key={r.id} className="flex flex-wrap gap-5 p-5">
                <div className="min-w-0 flex-[1_1_320px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-footnote font-semibold text-tint-blue">{r.course}</span>
                    <span className="text-headline font-semibold">{r.title}</span>
                    {r.isExam && <Badge tone="orange">Exam</Badge>}
                    <Confidence level={r.confidence} />
                  </div>
                  <Snippet text={r.sourceSnippet} file={r.sourceFile} />
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-52">
                  <Field label="Proposed date">
                    <Input type="date" value={value} onChange={(e) => setEdit(r.id, { dueDate: e.target.value })} />
                  </Field>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => actions.confirmTask(r.id, value ? { dueDate: value } : {})}>
                      <Check />
                      {changed ? 'Correct & confirm' : 'Confirm'}
                    </Button>
                    <Button variant="gray" size="icon" aria-label="Reject this date" onClick={() => actions.rejectTask(r.id)}>
                      <X />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {/* ── proposed new deliverables ───────────────────────────────────── */}
      {items.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeader>Proposed new items · {items.length}</SectionHeader>
          <Callout tone="gray">
            These dates matched no deliverable already in the deck. Give one a weight and an estimate to add it, or
            reject it.
          </Callout>
          {items.map((r) => {
            const e = edits[r.id] || {};
            return (
              <Card key={r.id} className="flex flex-wrap gap-5 p-5">
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-footnote font-semibold text-tint-blue">{r.course}</span>
                    <Confidence level={r.confidence} />
                  </div>
                  <Input
                    className="mt-2 text-headline font-semibold"
                    value={e.title ?? r.title}
                    onChange={(ev) => setEdit(r.id, { title: ev.target.value })}
                    aria-label="Title"
                  />
                  <Snippet text={r.sourceSnippet} file={r.sourceFile} />
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-56">
                  <div className="flex gap-2">
                    <Field label="Weight %" className="flex-1">
                      <Input inputMode="decimal" value={e.weight ?? ''} onChange={(ev) => setEdit(r.id, { weight: ev.target.value })} />
                    </Field>
                    <Field label="Est. hours" className="flex-1">
                      <Input inputMode="decimal" value={e.estHours ?? ''} onChange={(ev) => setEdit(r.id, { estHours: ev.target.value })} />
                    </Field>
                  </div>
                  <Field label="Due">
                    <Input type="date" value={e.dueDate ?? r.proposedDate ?? ''} onChange={(ev) => setEdit(r.id, { dueDate: ev.target.value })} />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() =>
                        actions.confirmTask(r.id, {
                          title: e.title ?? r.title,
                          weight: e.weight,
                          estHours: e.estHours,
                          dueDate: e.dueDate ?? r.proposedDate,
                        })
                      }
                    >
                      Add to deck
                    </Button>
                    <Button variant="gray" size="icon" aria-label="Reject this item" onClick={() => actions.rejectTask(r.id)}>
                      <X />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
